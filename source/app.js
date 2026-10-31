/* Continuous software-decoded MPEG1 live video. No HTML media player or camera credentials. */
(function () {
 "use strict";
 var panel=document.getElementById("panel"),canvas=document.getElementById("camera"),message=document.getElementById("message");
 var status=document.getElementById("status"),seconds=document.getElementById("seconds"),label=document.getElementById("label");
 var player=null,closeTimer=null,tickTimer=null,generation=0,lastFrame=0,frames=0,lastCount=0,started=0,showFps=true;
 /* top, right, bottom, left, transform; "m" is the edge margin */
 var places={"top-right":["m","m","auto","auto","none"],"top-left":["m","auto","auto","m","none"],"bottom-right":["auto","m","m","auto","none"],"bottom-left":["auto","auto","m","m","none"],"center":["50%","auto","auto","50%","translate(-50%,-50%)"]};
 function stop(){
  generation++;
  if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
  if(tickTimer!==null){clearInterval(tickTimer);tickTimer=null;}
  if(player){player.destroy();player=null;}
  canvas.style.visibility="hidden";
 }
 function dismiss(){stop();panel.style.display="none";try{window.close();}catch(e){}}
 function params(event){
  var p=event&&event.detail;
  if(p&&p.launchParams)p=p.launchParams;
  if(!p){try{p=window.PalmSystem&&window.PalmSystem.launchParams||window.webOSSystem&&window.webOSSystem.launchParams;}catch(e){}}
  if(typeof p==="string"){try{p=JSON.parse(p);}catch(e){p={};}}
  return p&&typeof p==="object"?p:{};
 }
 function bounded(value,low,high,fallback){value=Number(value);return isFinite(value)&&value>0?Math.max(low,Math.min(high,value)):fallback;}
 function style(p){
  var place=Object.prototype.hasOwnProperty.call(places,p.position)?places[p.position]:places["top-right"],compact=p.compact===true||p.compact==="true",border=!(p.border===false||p.border==="false");
  var m=p.margin===undefined||p.margin===null||p.margin===""?3:Number(p.margin),edge;
  if(!isFinite(m)||m<0||m>10||Math.floor(m)!==m)m=3;
  edge=function(v){return v==="m"?m+"vw":v;};
  showFps=!(p.fps===false||p.fps==="false");
  var color=typeof p.borderColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(p.borderColor)?p.borderColor:"#67dfad";
  panel.style.top=edge(place[0]);panel.style.right=edge(place[1]);panel.style.bottom=edge(place[2]);panel.style.left=edge(place[3]);panel.style.transform=place[4];
  panel.style.borderColor=color;panel.style.borderWidth=border?"3px":"0";panel.className=compact?"compact":"";
 }
 function show(event){
  stop();
  var p=params(event),url=p.stream||"",duration=bounded(p.duration,15,90,45),mine=generation;
  style(p);panel.style.display="block";panel.style.width=bounded(p.width,25,55,42)+"%";
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
   if(lastFrame&&now-lastFrame<3000){status.textContent=showFps?"LIVE · "+fps+" fps":"LIVE";status.style.color="#67dfad";}
   else if(now-started>8000){status.textContent="Stream stalled";status.style.color="#ffd38a";canvas.style.visibility="hidden";message.textContent="Waiting for live camera";message.style.display="block";}
   var socket=player&&player.source&&player.source.socket;
   if(socket&&socket.readyState===1){socket.send(JSON.stringify({type:"metrics",frames:frames,fps:fps,width:canvas.width,height:canvas.height,age:lastFrame?now-lastFrame:-1}));}
  },1000);
 }
 document.addEventListener("webOSRelaunch",show);
 document.addEventListener("keydown",function(e){if(e.keyCode===461||e.keyCode===27){e.preventDefault();dismiss();}});
 window.addEventListener("pagehide",stop);
 window.addEventListener("unload",stop);
 show();
}());
