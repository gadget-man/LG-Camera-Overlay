/* Samsung Tizen variant: HDMI picture shown full-screen behind a transparent page, camera panel on top. */
(function () {
 "use strict";
 var panel=document.getElementById("panel"),canvas=document.getElementById("camera"),message=document.getElementById("message");
 var status=document.getElementById("status"),seconds=document.getElementById("seconds"),label=document.getElementById("label");
 var conf=window.OVERLAY_CONFIG||{},player=null,closeTimer=null,tickTimer=null,generation=0,lastFrame=0,frames=0,lastCount=0,started=0,request=null;
 function stop(){
  generation++;
  if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
  if(tickTimer!==null){clearInterval(tickTimer);tickTimer=null;}
  if(request){try{request.abort();}catch(e){}request=null;}
  if(player){player.destroy();player=null;}
  canvas.style.visibility="hidden";
 }
 function dismiss(){
  stop();panel.style.display="none";
  try{tizen.application.getCurrentApplication().exit();}catch(e){try{window.close();}catch(x){}}
 }
 function bounded(value,low,high,fallback){value=Number(value);return isFinite(value)&&value>0?Math.max(low,Math.min(high,value)):fallback;}
 function payload(){
  // Optional JSON PAYLOAD when launched through the TV's DEEP_LINK app control.
  try{
   var data=tizen.application.getCurrentApplication().getRequestedAppControl().appControl.data||[];
   for(var i=0;i<data.length;i++)if(data[i].key==="PAYLOAD"&&data[i].value&&data[i].value[0]){var p=JSON.parse(data[i].value[0]);if(p&&typeof p==="object")return p;}
  }catch(e){}
  return null;
 }
 function relay(){return typeof conf.relay==="string"?conf.relay.replace(/\/+$/,""):"";}
 function pending(done){
  // Home Assistant posts the camera choice to the relay just before launching this app.
  var base=relay(),xhr;
  if(!/^https?:\/\/[^\s/]+$/.test(base)||typeof conf.token!=="string"||typeof conf.tvId!=="string"){done(null);return;}
  xhr=new XMLHttpRequest();request=xhr;
  xhr.open("GET",base+"/pending/"+conf.token+"/"+conf.tvId,true);xhr.timeout=5000;
  xhr.onload=function(){if(request!==xhr)return;request=null;var p=null;if(xhr.status===200){try{p=JSON.parse(xhr.responseText);}catch(e){}}done(p&&typeof p==="object"?p:null);};
  xhr.onerror=xhr.ontimeout=function(){if(request!==xhr)return;request=null;done(null);};
  xhr.send();
 }
 function hdmi(number,done){
  // Put the chosen HDMI input in the TV window behind the page. number 0 keeps the current source.
  var w;try{w=tizen.tvwindow;}catch(e){}
  if(!w){done(false);return;}
  function show(){try{w.show(function(){done(true);},function(){done(false);},["0px","0px","100%","100%"],"MAIN","BEHIND");}catch(e){done(false);}}
  if(!number){show();return;}
  try{var current=w.getSource("MAIN");if(current&&current.type==="HDMI"&&current.number===number){show();return;}}catch(e){}
  try{
   tizen.systeminfo.getPropertyValue("VIDEOSOURCE",function(info){
    var list=info&&info.connected||[];
    for(var i=0;i<list.length;i++)if(list[i].type==="HDMI"&&list[i].number===number){
     try{w.setSource(list[i],show,function(){done(false);},"MAIN");}catch(e){done(false);}return;
    }
    done(false);
   },function(){done(false);});
  }catch(e){done(false);}
 }
 function streamUrl(p){
  if(typeof p.stream==="string")return p.stream;
  var base=relay();if(!base||typeof p.camera!=="string")return "";
  return base.replace(/^http/,"ws")+"/live/"+conf.token+"/"+p.camera+"/"+conf.tvId;
 }
 function play(p,mine){
  var url=streamUrl(p),duration=bounded(p.duration,15,90,45);
  panel.style.display="block";panel.style.width=bounded(p.width,25,55,42)+"%";
  label.textContent=typeof p.label==="string"?p.label.slice(0,60):"Camera";
  seconds.textContent=String(Math.ceil(duration));status.textContent="Connecting...";
  status.style.color="#a9bac4";message.textContent="Connecting live camera...";message.style.display="block";
  started=Date.now();lastFrame=0;frames=0;lastCount=0;
  closeTimer=setTimeout(dismiss,duration*1000);
  if(!/^wss?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?\/[a-zA-Z0-9/_-]+$/.test(url)){
   status.textContent="No stream";message.textContent="Live stream was not supplied";return;
  }
  try{
   player=new JSMpeg.Player(url,{canvas:canvas,audio:false,autoplay:true,pauseWhenHidden:false,disableWebAssembly:true,videoBufferSize:1024*1024,
    onVideoDecode:function(){if(mine!==generation)return;frames++;lastFrame=Date.now();canvas.style.visibility="visible";message.style.display="none";if(frames===1){var socket=player&&player.source&&player.source.socket;if(socket&&socket.readyState===1)socket.send(JSON.stringify({type:"started",appStartupMs:lastFrame-started,sentAt:Number(p.sentAt)||0,detectedAt:Number(p.detectedAt)||0}));}}});
  }catch(e){status.textContent="Player error";message.textContent="Live video could not start";return;}
  tickTimer=setInterval(function(){
   var now=Date.now(),fps=frames-lastCount;lastCount=frames;
   seconds.textContent=String(Math.max(0,Math.ceil(duration-(now-started)/1000)));
   if(lastFrame&&now-lastFrame<3000){status.textContent="LIVE · "+fps+" fps";status.style.color="#67dfad";}
   else if(now-started>8000){status.textContent="Stream stalled";status.style.color="#ffd38a";canvas.style.visibility="hidden";message.textContent="Waiting for live camera";message.style.display="block";}
   var socket=player&&player.source&&player.source.socket;
   if(socket&&socket.readyState===1){socket.send(JSON.stringify({type:"metrics",frames:frames,fps:fps,width:canvas.width,height:canvas.height,age:lastFrame?now-lastFrame:-1}));}
  },1000);
 }
 function launch(){
  stop();
  var mine=generation;
  function begin(p){
   if(mine!==generation)return;
   if(!p){panel.style.display="block";status.textContent="No camera";message.textContent="No camera was requested";message.style.display="block";closeTimer=setTimeout(dismiss,8000);return;}
   var input=p.hdmi===undefined?(conf.hdmi===undefined?1:conf.hdmi):p.hdmi;
   hdmi(Number(input)||0,function(ok){
    if(mine!==generation)return;
    play(p,mine);
    if(!ok){status.textContent="No HDMI picture";status.style.color="#ffd38a";}
   });
  }
  var p=payload();if(p)begin(p);else pending(begin);
 }
 window.addEventListener("appcontrol",launch);
 document.addEventListener("visibilitychange",function(){if(document.hidden)dismiss();});
 document.addEventListener("keydown",function(e){if(e.keyCode===10009||e.keyCode===27){e.preventDefault();dismiss();}});
 window.addEventListener("pagehide",stop);
 window.addEventListener("unload",stop);
 launch();
}());
