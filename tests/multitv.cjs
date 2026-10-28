"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),{EventEmitter}=require("events");
const source=fs.readFileSync("relay/relay.cjs","utf8");
function rig(){
 const children=[],writes=[],timers=[],ssh=[];
 const config={port:8766,token:"fake",hardwareDecode:"videotoolbox",ffmpeg:"ffmpeg",sources:{front_left:"fake-left",front_right:"fake-right",g6_entry:"fake-g6"},tvs:{living_room:{privateKey:"key-a",hostKeySha256:"hash-a"},master_bedroom:{privateKey:"key-b",hostKeySha256:"hash-b"}}};
 const fakeFs={readFileSync:p=>p.endsWith("config.json")?JSON.stringify(config):p.endsWith("timing.json")?"[]":"fake-key",writeFileSync:(p,s)=>writes.push({p,s}),renameSync(){}};
 const server=new EventEmitter();server.listen=()=>{};server.close=()=>{};
 class WS extends EventEmitter{constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];}send(d){this.sent.push(d)}close(){this.readyState=3;this.emit("close")}terminate(){this.terminated=true;this.close()}}
 class WSS extends EventEmitter{constructor(){super();this.close=()=>{};this.handleUpgrade=(r,s,h,fn)=>{s.ws=new WS();fn(s.ws);}}}
 class SSH extends EventEmitter{constructor(){super();ssh.push(this)}connect(c){this.config=c}forwardIn(i,p,fn){fn(null)}end(){this.emit("close")}}
 const answers={living_room:[],master_bedroom:[]},sessionCalls=[];
 const ctx=vm.createContext({__dirname:"/test",require:n=>({"fs":fakeFs,"crypto":require("crypto"),"path":require("path"),"http":{createServer:()=>server},"net":{},"child_process":{spawn:(p,args)=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.pid=children.length+1;c.args=args;c.kill=()=>{c.killed=true};children.push(c);return c}},"ws":{WebSocketServer:WSS},"ssh2":{Client:SSH},"./config.cjs":{load:()=>({root:"/test",conf:config})},"./devmode.cjs":{run:async(renew,tv,id)=>{sessionCalls.push({renew,id});const value=answers[id].shift();if(value instanceof Error)throw value;return value}}}[n]),console:{log(){}},process:{on(){},memoryUsage:()=>({rss:0}),exit(){}},setTimeout:(fn,delay)=>{const t={fn,delay,unref(){return this}};timers.push(t);return t},clearTimeout(){},Date,JSON,Number,Set,Map,Buffer});
 vm.runInContext(source,ctx);
 const get=code=>vm.runInContext(code,ctx),connect=(camera,tv)=>{const ws=new WS();get("wss").emit("connection",ws,camera,tv);return ws};
 return {get,connect,children,server,ssh,timers,answers,sessionCalls};
}
(async()=>{
 const r=rig(),a=r.connect("front_left","living_room"),b=r.connect("front_left","master_bedroom");
 assert.equal(r.children.length,1,"Both TVs must share one camera encoder");
 r.children[0].stdout.emit("data",Buffer.from("frame"));assert.equal(a.sent.length,1);assert.equal(b.sent.length,1);
 const ack=JSON.stringify({type:"started",appStartupMs:123,sentAt:Date.now()-200,detectedAt:Date.now()-205});
 a.emit("message",Buffer.from(ack));b.emit("message",Buffer.from(ack));a.emit("message",Buffer.from(ack));
 assert.equal(r.get("timingHistory.length"),2,"First-frame acknowledgment must be recorded separately for each TV");
 assert.deepEqual(JSON.parse(JSON.stringify(r.get("timingHistory.map(x=>x.tv_id)"))),["living_room","master_bedroom"]);
 const a2=r.connect("front_left","living_room");assert.equal(a.terminated,true);assert.equal(b.terminated,undefined);assert.equal(r.children.length,1);
 a.emit("message",Buffer.from(ack));assert.equal(r.get("timingHistory.length"),2,"Stale client must not record timing");
 const a3=r.connect("g6_entry","living_room");assert.equal(a2.terminated,true);assert.equal(r.children.length,2);assert.equal(r.children[0].killed,undefined);
 r.children[1].stdout.emit("data",Buffer.from("bell"));assert.equal(a3.sent.length,1);assert.equal(b.sent.length,1);
 a3.close();assert.equal(r.children[1].killed,true);assert.equal(r.children[0].killed,undefined);b.close();assert.equal(r.children[0].killed,true);assert.equal(r.get("streams.size"),0);
 const s=rig(),slow=s.connect("front_left","living_room"),fast=s.connect("front_left","master_bedroom");
 slow.bufferedAmount=1024*1024+1;s.children[0].stdout.emit("data",Buffer.from("frame"));assert.equal(slow.readyState,3);assert.equal(fast.sent.length,1);assert.equal(s.children[0].killed,undefined);
 s.children[0].emit("exit",1);assert.equal(s.children.length,1,"After receiving bytes an error should not silently restart encoder");assert.equal(fast.readyState,3);
 const f=rig();f.connect("front_left","living_room");f.children[0].emit("exit",1);assert.equal(f.children.length,2);assert(!f.children[1].args.includes("-hwaccel"),"Hardware decode fallback must be software-only");
 for(const url of ["/live/wrong/front_left/living_room","/live/fake/front_left/unknown_tv"]){let response;f.server.emit("upgrade",{url},{end:v=>response=v},Buffer.alloc(0));assert(response.startsWith("HTTP/1.1 403"));}
 const m=rig();m.answers.living_room.push({time:"t",before:{success:true,remaining:"167:59:59"}},{time:"t",reset:{success:true},after:{success:true,remaining:"999:59:59"}});
 m.answers.master_bedroom.push({time:"t",before:{success:true,remaining:"168:00:00"}});
 await m.get("maintainDevMode(tvs.get('living_room'))");await m.get("maintainDevMode(tvs.get('master_bedroom'))");
 assert.equal(m.get("tvs.get('living_room').sessionStatus.renewed"),true);assert.equal(m.get("tvs.get('master_bedroom').sessionStatus.renewed"),false);
 m.answers.master_bedroom.push(new Error("Offline"));await m.get("maintainDevMode(tvs.get('master_bedroom'))");
 assert.equal(m.get("tvs.get('master_bedroom').sessionTimer.delay"),3600000);assert.equal(m.get("tvs.get('living_room').sessionStatus.success"),true);
 m.get("connectTV(tvs.get('living_room'));connectTV(tvs.get('master_bedroom'))");m.ssh[0].emit("ready");m.ssh[1].emit("ready");m.ssh[0].emit("close");
 assert.equal(m.ssh[0].config.hostVerifier('hash-a'),true);assert.equal(m.ssh[0].config.hostVerifier('unexpected'),false,'Unpinned SSH hosts must be rejected');
 const broken=rig(),bad=broken.connect('front_left','living_room');broken.children[0].emit('error',new Error('private URL'));assert.equal(bad.readyState,3);assert.equal(broken.get('streams.size'),0,'Failed spawn must release viewer and stream');
 const privacy=rig();privacy.connect('front_left','living_room');privacy.children[0].stderr.emit('data',Buffer.from('password=secret arbitrary sensitive text'));assert(!JSON.stringify(privacy.get('health()')).includes('secret'),'Raw stderr must never reach health');
 assert.equal(m.get("tvs.get('living_room').ready"),false);assert.equal(m.get("tvs.get('master_bedroom').ready"),true);assert.equal(m.get("tvs.get('living_room').retry.delay"),15000);
 console.log("PASS: two TVs share encoder; per-TV replacement, close and timing; isolated slow client; software fallback; rejected unknown TV; independent session checks and reconnects");
})().catch(e=>{console.error(e);process.exitCode=1});
