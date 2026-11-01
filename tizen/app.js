/* Samsung Tizen variant: HDMI picture shown full-screen behind a transparent page, camera picture-in-picture on top.
   The app stays open between alerts. Exiting would make the TV drop back to its own default source rather than
   the HDMI input, and relaunching flashes the screen black, so the app keeps the HDMI picture behind it and
   checks the relay for the next request instead. */
(function () {
 "use strict";
 var panel=document.getElementById("panel"),canvas=document.getElementById("camera"),message=document.getElementById("message");
 var status=document.getElementById("status"),seconds=document.getElementById("seconds"),label=document.getElementById("label");
 var conf=window.OVERLAY_CONFIG||{},player=null,closeTimer=null,tickTimer=null,pollTimer=null,generation=0,lastFrame=0,frames=0,lastCount=0,started=0,shownAt=0,request=null,active=false;
 function stop(){
  generation++;active=false;
  if(closeTimer!==null){clearTimeout(closeTimer);closeTimer=null;}
  if(tickTimer!==null){clearInterval(tickTimer);tickTimer=null;}
  if(request){try{request.abort();}catch(e){}request=null;}
  if(player){player.destroy();player=null;}
  canvas.style.visibility="hidden";panel.style.visibility="hidden";
 }
 function quit(){
  // Only used when BACK is pressed with no camera showing: the viewer chose to leave the app.
  stop();if(pollTimer!==null){clearInterval(pollTimer);pollTimer=null;}
  try{tizen.application.getCurrentApplication().exit();}catch(e){try{window.close();}catch(x){}}
 }
 /* Panel position, as in the LG app: top, right, bottom, left, transform; "m" is the edge margin. */
 var places={"top-right":["m","m","auto","auto","none"],"top-left":["m","auto","auto","m","none"],"bottom-right":["auto","m","m","auto","none"],"bottom-left":["auto","auto","m","m","none"],"center":["50%","auto","auto","50%","translate(-50%,-50%)"]};
 function style(p){
  // Same request fields as the LG launch blueprint (position, margin, border, borderColor, compact); fps does not apply here.
  var place=Object.prototype.hasOwnProperty.call(places,p.position)?places[p.position]:places["top-right"],m=p.margin===undefined||p.margin===null||p.margin===""?3:Number(p.margin);
  if(!isFinite(m)||m<0||m>10||Math.floor(m)!==m)m=3;
  function edge(v){return v==="m"?m+"vw":v;}
  var border=!(p.border===false||p.border==="false"),compact=p.compact===true||p.compact==="true";
  panel.style.top=edge(place[0]);panel.style.right=edge(place[1]);panel.style.bottom=edge(place[2]);panel.style.left=edge(place[3]);panel.style.transform=place[4];
  panel.style.borderColor=typeof p.borderColor==="string"&&/^#[0-9a-fA-F]{6}$/.test(p.borderColor)?p.borderColor:"rgba(255,255,255,.6)";
  panel.style.borderWidth=border?"2px":"0";panel.className=compact?"compact":"";
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
  // Home Assistant posts the camera choice to the relay; the open app picks it up here.
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
 function background(){
  // Show the configured HDMI input straight away so the page is never an empty black screen.
  hdmi(Number(conf.hdmi===undefined?1:conf.hdmi)||0,function(){});
 }
 function streamUrl(p){
  if(typeof p.stream==="string")return p.stream;
  var base=relay();if(!base||typeof p.camera!=="string")return "";
  return base.replace(/^http/,"ws")+"/live/"+conf.token+"/"+p.camera+"/"+conf.tvId;
 }
 function play(p,mine){
  var url=streamUrl(p),duration=bounded(p.duration,15,90,45);
  active=true;
  style(p);panel.style.display="block";panel.style.visibility="hidden";panel.style.width=bounded(p.width,10,55,25)+"%";
  label.textContent=typeof p.label==="string"?p.label.slice(0,60):"Camera";
  seconds.textContent=String(Math.ceil(duration));status.textContent="Connecting...";
  status.style.color="#a9bac4";message.textContent="Connecting live camera...";message.style.display="block";
  started=Date.now();shownAt=0;lastFrame=0;frames=0;lastCount=0;
  // The countdown starts when the picture first appears, not when the request arrives.
  // If no picture arrives within 20 seconds, give up so the app is ready for the next alert.
  closeTimer=setTimeout(stop,20000);
  if(!/^wss?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d+)?\/[a-zA-Z0-9/_-]+$/.test(url)){
   status.textContent="No stream";message.textContent="Live stream was not supplied";return;
  }
  try{
   player=new JSMpeg.Player(url,{canvas:canvas,audio:false,autoplay:true,pauseWhenHidden:false,disableWebAssembly:true,videoBufferSize:1024*1024,
    onVideoDecode:function(){if(mine!==generation)return;frames++;lastFrame=Date.now();canvas.style.visibility="visible";panel.style.visibility="visible";message.style.display="none";if(frames===1){shownAt=lastFrame;clearTimeout(closeTimer);closeTimer=setTimeout(stop,duration*1000);var socket=player&&player.source&&player.source.socket;if(socket&&socket.readyState===1)socket.send(JSON.stringify({type:"started",appStartupMs:lastFrame-started,sentAt:Number(p.sentAt)||0,detectedAt:Number(p.detectedAt)||0}));}}});
  }catch(e){status.textContent="Player error";message.textContent="Live video could not start";return;}
  tickTimer=setInterval(function(){
   var now=Date.now(),fps=frames-lastCount;lastCount=frames;
   if(shownAt)seconds.textContent=String(Math.max(0,Math.ceil(duration-(now-shownAt)/1000)));
   if(lastFrame&&now-lastFrame<3000){status.textContent="LIVE · "+fps+" fps";status.style.color="#67dfad";}
   else if(now-started>8000){status.textContent="Stream stalled";status.style.color="#ffd38a";canvas.style.visibility="hidden";message.textContent="Waiting for live camera";message.style.display="block";}
   var socket=player&&player.source&&player.source.socket;
   if(socket&&socket.readyState===1){socket.send(JSON.stringify({type:"metrics",frames:frames,fps:fps,width:canvas.width,height:canvas.height,age:lastFrame?now-lastFrame:-1}));}
  },1000);
 }
 function start(p){
  stop();
  var mine=generation,input=p.hdmi===undefined?(conf.hdmi===undefined?1:conf.hdmi):p.hdmi;
  // Start the camera stream straight away; making sure the HDMI picture is behind it runs alongside.
  play(p,mine);
  hdmi(Number(input)||0,function(ok){
   if(mine!==generation)return;
   if(!ok){status.textContent="No HDMI picture";status.style.color="#ffd38a";}
  });
 }
 function check(){
  // Ask the relay whether Home Assistant has requested the camera. Skipped while a camera is showing.
  if(active||request)return;
  var mine=generation;
  pending(function(p){if(p&&mine===generation&&!active)start(p);});
 }
 function launched(){
  // First start, or Home Assistant relaunching the already-open app: never interrupt a camera that is showing.
  var p=payload();if(p){start(p);return;}
  check();
 }
 window.addEventListener("appcontrol",launched);
 document.addEventListener("visibilitychange",function(){if(document.hidden)stop();else background();});
 document.addEventListener("keydown",function(e){if(e.keyCode===10009||e.keyCode===27){e.preventDefault();if(active)stop();else quit();}});
 window.addEventListener("pagehide",stop);
 window.addEventListener("unload",stop);
 background();
 launched();
 pollTimer=setInterval(check,1000);
}());
