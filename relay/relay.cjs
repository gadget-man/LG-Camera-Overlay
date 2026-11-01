// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),net=require("net"),crypto=require("crypto"),{spawn}=require("child_process");
const {WebSocketServer}=require("ws"),{Client}=require("ssh2");
const {root,conf}=require("./config.cjs").load();
const tvConfigs=conf.tvs;
const tvs=new Map(Object.entries(tvConfigs).map(([id,config])=>{
 if(!/^[a-z][a-z0-9_]{0,40}$/.test(id))throw Error("Invalid TV identifier");
 return [id,{id,config,connection:null,ready:false,retry:null,sessionTimer:null,sessionStatus:null}];
}));
if(!tvs.size)throw Error("No TVs configured");
const streams=new Map(),clients=new Set(),pending=new Map(),timingPath=path.join(root,"logs/timing.json");
const listenHost=conf.listenHost||"127.0.0.1",localHost=["0.0.0.0","::"].includes(listenHost)?"127.0.0.1":listenHost;
let stopping=false,lastMetric=null,lastFirstFrame=null,sessionStatus=null;
let timingHistory=[];try{timingHistory=JSON.parse(fs.readFileSync(timingPath,"utf8")).slice(-99);}catch(e){}
const devmode=require("./devmode.cjs");
function log(event,data){console.log(JSON.stringify(Object.assign({time:new Date().toISOString(),event},data||{})));}
function elapsed(now,stamp){return Number.isFinite(stamp)&&stamp>0&&now-stamp>=0&&now-stamp<120000?now-stamp:null;}
function recordTiming(value){
 timingHistory.push(value);timingHistory=timingHistory.slice(-100);
 try{fs.writeFileSync(timingPath+".tmp",JSON.stringify(timingHistory,null,2),{mode:0o600});fs.renameSync(timingPath+".tmp",timingPath);}catch(e){log("timing_save_failed");}
 log("first_frame",value);
}
function sessionSeconds(value){
 if(typeof value!=="string"||!/^\d+:\d{2}:\d{2}$/.test(value))return null;
 const p=value.split(":").map(Number);return p[0]*3600+p[1]*60+p[2];
}
function tokenOk(value){const a=Buffer.from(String(value)),b=Buffer.from(String(conf.token));return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function webosTVs(){return [...tvs.values()].filter(tv=>tv.config.platform!=="tizen");}
async function maintainDevMode(tv=tvs.get("living_room")||webosTVs()[0]){
 let next=86400000;
 try{
  const checked=await devmode.run(false,tv.config,tv.id),before=sessionSeconds(checked.before.remaining);
  if(!checked.before.success||before===null)throw Error("Invalid session status");
  tv.sessionStatus={checked_at:checked.time,success:true,remaining:checked.before.remaining,renewed:false};
  if(before<604800){
   const renewed=await devmode.run(true,tv.config,tv.id),after=sessionSeconds(renewed.after.remaining);
   tv.sessionStatus={checked_at:renewed.time,success:!!(renewed.reset.success&&renewed.after.success&&after>before),remaining:renewed.after.remaining,renewed:true};
   if(!tv.sessionStatus.success)next=3600000;
  }
  fs.writeFileSync(path.join(root,"logs/devmode-status-"+tv.id+".json"),JSON.stringify(tv.sessionStatus,null,2),{mode:0o600});
  log("devmode_session_checked",{tv_id:tv.id,...tv.sessionStatus});
 }catch(e){
  next=3600000;tv.sessionStatus={checked_at:new Date().toISOString(),success:false,error:"Session check failed; retry in one hour"};
  log("devmode_session_check_failed",{tv_id:tv.id});
 }
 if(tv===webosTVs()[0])sessionStatus=tv.sessionStatus;
 if(!stopping)tv.sessionTimer=setTimeout(()=>maintainDevMode(tv),next).unref();
}
function stopStream(group){
 if(streams.get(group.camera)!==group)return;
 streams.delete(group.camera);const child=group.encoder;group.encoder=null;if(child)child.kill("SIGTERM");
}
function detach(ws){
 if(!clients.delete(ws))return;
 const group=ws.group;ws.group=null;if(group){group.clients.delete(ws);if(!group.clients.size&&!(group.warmUntil>Date.now()))stopStream(group);}
}
function prewarm(camera){
 // Start the camera feed when Home Assistant asks, so it is already running when the TV app connects.
 let group=streams.get(camera);
 if(!group){group={camera,encoder:null,clients:new Set(),bytes:0,error:null};streams.set(camera,group);}
 group.warmUntil=Date.now()+20000;
 if(!group.encoder)encode(group,conf.hardwareDecode!=="videotoolbox");
 clearTimeout(group.warmTimer);
 group.warmTimer=setTimeout(()=>{if(!group.clients.size)stopStream(group);},20500);group.warmTimer.unref();
}
function encode(group,software){
 if(stopping||streams.get(group.camera)!==group||(!group.clients.size&&!(group.warmUntil>Date.now())))return;
 const args=["-hide_banner","-loglevel","error"];
 if(!software&&conf.hardwareDecode==="videotoolbox")args.push("-hwaccel","videotoolbox");
 args.push("-fflags","nobuffer","-probesize","500000","-analyzeduration","500000","-rtsp_transport","tcp","-i",conf.sources[group.camera],"-an","-vf","scale=768:432","-r","25","-c:v","mpeg1video","-b:v","2200k","-maxrate","2600k","-bufsize","5200k","-bf","0","-g","12","-threads","2","-t","95","-f","mpegts","-muxdelay","0.001","pipe:1");
 const child=spawn(conf.ffmpeg,args,{cwd:root,stdio:["ignore","pipe","pipe"]});group.encoder=child;
 child.stdout.on("data",data=>{
  if(group.encoder!==child)return;
  group.bytes+=data.length;
  for(const ws of group.clients)if(ws.readyState===1){
   if(ws.bufferedAmount>1024*1024){detach(ws);ws.close(1013,"Slow client");}
   else ws.send(data);
  }
 });
 child.stderr.on("data",()=>{if(group.encoder===child)group.error="Encoder reported an error; check source connectivity and FFmpeg support";});
 child.on("error",()=>{if(group.encoder!==child)return;group.error="Encoder could not start";for(const ws of [...group.clients]){detach(ws);ws.close(1011,"Encoder unavailable");}stopStream(group);});
 child.on("exit",code=>{
  if(group.encoder!==child)return;group.encoder=null;
  if(code!==0&&!software&&!group.bytes&&group.clients.size){log("software_decode_fallback",{camera:group.camera});encode(group,true);return;}
  for(const ws of [...group.clients]){detach(ws);ws.close(1011,"Encoder ended");}
  stopStream(group);log("encoder_ended",{camera:group.camera,code,bytes:group.bytes});
 });
 log("encoder_started",{camera:group.camera,input_decode:software?"software":"videotoolbox"});
}
function health(){
 const active=[...streams.values()],living=tvs.get("living_room")||tvs.values().next().value;
 return {
  tunnel_ready:living.ready,tv_tunnels:Object.fromEntries([...tvs].map(([id,tv])=>[id,{ready:tv.ready}])),
  encoder_running:active.some(g=>!!g.encoder),encoder_pid:active[0]?.encoder?.pid||null,
  camera:active.length===1?active[0].camera:null,clients:clients.size,bytes:active.reduce((n,g)=>n+g.bytes,0),
  streams:active.map(g=>({camera:g.camera,encoder_pid:g.encoder?.pid||null,clients:g.clients.size,bytes:g.bytes,error:g.error})),
  tv_clients:[...clients].map(ws=>({tv_id:ws.tvId,camera:ws.group?.camera,first_frame:ws.firstFrame||null,metrics:ws.metric||null})),
  metrics:lastMetric,first_frame:lastFirstFrame,timing_history:timingHistory.slice(-8),error:active.find(g=>g.error)?.error||null,
  developer_mode:sessionStatus,developer_modes:Object.fromEntries([...tvs].map(([id,tv])=>[id,tv.sessionStatus])),
  node_rss_mb:Math.round(process.memoryUsage().rss/1048576)
 };
}
function bounded(value,low,high){value=Number(value);return Number.isFinite(value)&&value>0?Math.max(low,Math.min(high,value)):undefined;}
function showRequest(tvId,m){
 // Launch parameters for a Tizen TV, collected by its app on startup. Unknown fields are dropped.
 if(!m||typeof m!=="object"||!Object.prototype.hasOwnProperty.call(conf.sources,m.camera))return null;
 const tv=tvs.get(tvId).config,value={camera:m.camera,label:typeof m.label==="string"?m.label.slice(0,60):"Camera",sentAt:Date.now()};
 const duration=bounded(m.duration,15,90),width=bounded(m.width,10,55),hdmi=Number.isInteger(m.hdmi)&&m.hdmi>=0&&m.hdmi<=4?m.hdmi:tv.hdmi;
 if(duration)value.duration=duration;if(width)value.width=width;if(hdmi!==undefined)value.hdmi=hdmi;
 if(Number.isFinite(Number(m.detectedAt))&&Number(m.detectedAt)>0)value.detectedAt=Number(m.detectedAt);
 // Panel appearance, same names and ranges as the LG launch blueprint. Invalid values are dropped so the app uses its default.
 const flag=v=>v===true||v==="true"?true:v===false||v==="false"?false:undefined;
 if(["top-right","top-left","bottom-right","bottom-left","center"].includes(m.position))value.position=m.position;
 const margin=Number(m.margin);if(m.margin!==null&&m.margin!==""&&Number.isInteger(margin)&&margin>=0&&margin<=10)value.margin=margin;
 if(flag(m.border)!==undefined)value.border=flag(m.border);
 if(typeof m.borderColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(m.borderColor))value.borderColor=m.borderColor;
 if(flag(m.compact)!==undefined)value.compact=flag(m.compact);
 return value;
}
const server=http.createServer((req,res)=>{
 if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});return res.end(JSON.stringify(health()));}
 const pieces=(req.url||"").split("/"),tvId=pieces[3];
 if(pieces.length===4&&["show","pending"].includes(pieces[1])){
  if(!tokenOk(pieces[2])||!tvs.has(tvId)){res.writeHead(403);return res.end();}
  if(pieces[1]==="pending"&&req.method==="GET"){
   const value=pending.get(tvId);pending.delete(tvId);
   const headers={"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"};
   if(!value||Date.now()-value.sentAt>60000){res.writeHead(204,headers);return res.end();}
   res.writeHead(200,{...headers,"Content-Type":"application/json"});return res.end(JSON.stringify(value));
  }
  if(pieces[1]==="show"&&req.method==="POST"){
   let body="";
   req.on("data",chunk=>{body+=chunk;if(body.length>2048){res.writeHead(413);res.end();req.destroy();}});
   req.on("end",()=>{
    if(res.writableEnded)return;let value=null;try{value=showRequest(tvId,JSON.parse(body));}catch(e){}
    if(!value){res.writeHead(400);return res.end();}
    pending.set(tvId,value);log("show_requested",{tv_id:tvId,camera:value.camera});prewarm(value.camera);res.writeHead(204);res.end();
   });
   return;
  }
 }
 res.writeHead(404);res.end();
});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
server.on("upgrade",(req,socket,head)=>{
 const pieces=(req.url||"").split("/"),camera=pieces[3],tvId=pieces[4];
 if(pieces.length!==5||pieces[1]!=="live"||!tokenOk(pieces[2])||!Object.prototype.hasOwnProperty.call(conf.sources,camera)||!tvs.has(tvId)){
  socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");return;
 }
 wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,camera,tvId));
});
wss.on("connection",(ws,camera,tvId)=>{
 const old=[...clients].filter(c=>c.tvId===tvId);
 let group=streams.get(camera);
 if(!group){group={camera,encoder:null,clients:new Set(),bytes:0,error:null};streams.set(camera,group);}
 ws.tvId=tvId;ws.group=group;ws.firstFrame=null;ws.metric=null;
 group.clients.add(ws);clients.add(ws);
 for(const prior of old){detach(prior);prior.terminate();}
 const connectedAt=Date.now();if(!group.encoder)encode(group,conf.hardwareDecode!=="videotoolbox");
 ws.on("error",()=>{});
 ws.on("message",data=>{
  try{
   if(!clients.has(ws))return;const m=JSON.parse(data.toString()),now=Date.now();
   if(m.type==="started"&&!ws.firstFrame&&Number.isFinite(m.appStartupMs)&&m.appStartupMs>=0&&m.appStartupMs<120000){
    ws.firstFrame={tv_id:tvId,camera,first_frame_at:new Date(now).toISOString(),detection_at:Number(m.detectedAt)||null,command_at:Number(m.sentAt)||null,app_to_first_frame_ms:m.appStartupMs,relay_to_first_frame_ms:now-connectedAt,command_to_first_frame_ms:elapsed(now,Number(m.sentAt)),detection_to_first_frame_ms:elapsed(now,Number(m.detectedAt)),detection_to_command_ms:elapsed(Number(m.sentAt),Number(m.detectedAt))};
    lastFirstFrame=ws.firstFrame;recordTiming(ws.firstFrame);
   }
   if(m.type==="metrics"&&["frames","fps","width","height","age"].every(k=>Number.isFinite(m[k])&&Math.abs(m[k])<1e8)){
    ws.metric={time:now,frames:m.frames,fps:m.fps,width:m.width,height:m.height,age:m.age};lastMetric={tv_id:tvId,...ws.metric};
   }
  }catch(e){}
 });
 ws.on("close",()=>detach(ws));
});
function scheduleReconnect(tv){
 tv.ready=false;if(!stopping&&!tv.retry)tv.retry=setTimeout(()=>{tv.retry=null;connectTV(tv);},15000);
}
function connectTV(tv){
 if(stopping)return;const connection=new Client();tv.connection=connection;
 connection.on("ready",()=>connection.forwardIn("127.0.0.1",conf.port,err=>{
  if(err){log("tv_forward_unavailable",{tv_id:tv.id});connection.end();return;}
  tv.ready=true;log("tv_tunnel_ready",{tv_id:tv.id});
 }));
 connection.on("tcp connection",(info,accept,reject)=>{
  if(info.destIP!=="127.0.0.1"||info.destPort!==conf.port){reject();return;}
  const channel=accept(),socket=net.connect(conf.port,localHost);
  channel.pipe(socket).pipe(channel);channel.on("error",()=>socket.destroy());socket.on("error",()=>channel.destroy());
 });
 connection.on("error",()=>{});connection.on("close",()=>scheduleReconnect(tv));
 const c=tv.config;
 connection.connect({host:c.host,port:c.port,username:c.username,privateKey:fs.readFileSync(path.join(root,c.privateKey)),passphrase:c.passphrase,hostHash:"sha256",hostVerifier:hash=>hash===c.hostKeySha256,readyTimeout:10000,keepaliveInterval:15000,keepaliveCountMax:2});
}
function shutdown(){
 stopping=true;for(const tv of tvs.values()){if(tv.sessionTimer)clearTimeout(tv.sessionTimer);if(tv.retry)clearTimeout(tv.retry);if(tv.connection)tv.connection.end();}
 for(const ws of [...clients]){detach(ws);ws.terminate();}
 for(const group of [...streams.values()])stopStream(group);
 wss.close();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();
}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
server.on("error",err=>{log("listener_error",{code:err.code});shutdown();});
server.listen(conf.port,listenHost,()=>{
 log("relay_ready",{listen:listenHost});let stagger=0;
 for(const tv of tvs.values()){if(tv.config.platform==="tizen"){tv.ready=true;continue;}connectTV(tv);if(conf.renewDeveloperMode)tv.sessionTimer=setTimeout(()=>maintainDevMode(tv),5000+stagger).unref();stagger+=1000;}
});
