// SPDX-License-Identifier: GPL-3.0-only
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function rig(opts){
 const handlers={},timers=new Map(),nodes={},calls=[],xhrs=[];let id=0,exited=0,options,destroyed=0;
 for(const key of ['panel','camera','message','status','seconds','label'])nodes[key]={style:{},textContent:'',width:768,height:432};
 let source={type:'TV',number:1};
 const tvwindow={getSource:()=>source,setSource:(s,ok)=>{calls.push(['setSource',s.type,s.number]);source=s;ok(s,'MAIN');},show:(ok,err,rect,type,z)=>{calls.push(['show',rect.join(','),type,z]);ok(rect,type);}};
 const sources=[{type:'HDMI',number:1},{type:'HDMI',number:2}];
 class XHR{constructor(){xhrs.push(this)}open(m,u){this.method=m;this.url=u}send(){}abort(){this.aborted=true}}
 const context={document:{getElementById:k=>nodes[k],addEventListener:(k,f)=>handlers[k]=f},
  window:{OVERLAY_CONFIG:{relay:'http://192.0.2.10:8766/',token:'t0k',tvId:'lounge',hdmi:1},addEventListener:(k,f)=>handlers[k]=f},
  tizen:{tvwindow,systeminfo:{getPropertyValue:(k,ok)=>ok({connected:sources})},application:{getCurrentApplication:()=>({exit:()=>exited++,getRequestedAppControl:()=>({appControl:{data:opts.payload?[{key:'PAYLOAD',value:[JSON.stringify(opts.payload)]}]:[]}})})}},
  XMLHttpRequest:XHR,setTimeout:(f,t)=>{timers.set(++id,{f,t,type:'timeout'});return id},setInterval:(f,t)=>{timers.set(++id,{f,t,type:'interval'});return id},clearTimeout:i=>timers.delete(i),clearInterval:i=>timers.delete(i),Date,JSON,Number,isFinite,
  JSMpeg:{Player:function(url,o){options=o;options.url=url;this.source={socket:{readyState:1,send(){}}};this.destroy=()=>destroyed++;}}};
 vm.runInNewContext(fs.readFileSync('tizen/app.js','utf8'),context);
 return {handlers,timers,nodes,calls,xhrs,get options(){return options},get exited(){return exited},get destroyed(){return destroyed}};
}
const timeouts=r=>[...r.timers.values()].filter(t=>t.type==='timeout');
// Startup: HDMI 1 goes behind the page at once (no black screen), then the relay is asked for a camera.
const a=rig({});assert.deepEqual(a.calls,[['setSource','HDMI',1],['show','0px,0px,100%,100%','MAIN','BEHIND']]);
assert.equal(a.xhrs.length,1);assert.equal(a.xhrs[0].url,'http://192.0.2.10:8766/pending/t0k/lounge');
a.xhrs[0].status=200;a.xhrs[0].responseText=JSON.stringify({camera:'entrance',label:'Front door',duration:30,width:20});a.xhrs[0].onload();
assert.equal(a.calls.filter(c=>c[0]==='setSource').length,1,'HDMI already selected is not switched again');
assert.equal(a.options.url,'ws://192.0.2.10:8766/live/t0k/entrance/lounge');assert.equal(a.options.audio,false);
assert.equal(a.nodes.panel.style.width,'20%');assert.equal(a.nodes.panel.style.visibility,'hidden','Picture stays hidden until the first frame');
assert.equal(a.nodes.seconds.textContent,'30');assert.equal(timeouts(a).length,1);assert.equal(timeouts(a)[0].t,20000,'Gives up if no picture arrives');
a.options.onVideoDecode();assert.equal(a.nodes.panel.style.visibility,'visible');
assert.equal(timeouts(a).length,1);assert.equal(timeouts(a)[0].t,30000,'Countdown starts at the first frame');
// While a camera shows, polling and an HA relaunch do not interrupt it.
const before=a.xhrs.length;for(const t of [...a.timers.values()])if(t.type==='interval')t.f();a.handlers.appcontrol();assert.equal(a.xhrs.length,before);assert.equal(a.destroyed,0);
// Time up: the camera stops but the app stays open on HDMI, so the TV keeps showing the HDMI input.
timeouts(a)[0].f();assert.equal(a.exited,0,'App must not exit when the timer ends');assert.equal(a.destroyed,1);assert.equal(a.nodes.panel.style.visibility,'hidden');
// The next request is picked up by polling without relaunching the app.
for(const t of [...a.timers.values()])if(t.type==='interval')t.f();const next=a.xhrs[a.xhrs.length-1];assert.equal(next.url,'http://192.0.2.10:8766/pending/t0k/lounge');
next.status=200;next.responseText=JSON.stringify({camera:'garage'});next.onload();assert.equal(a.options.url,'ws://192.0.2.10:8766/live/t0k/garage/lounge');
// BACK with a camera showing only hides it; BACK with nothing showing leaves the app.
a.handlers.keydown({keyCode:10009,preventDefault(){}});assert.equal(a.exited,0);assert.equal(a.destroyed,2);
a.handlers.keydown({keyCode:10009,preventDefault(){}});assert.equal(a.exited,1);
// Nothing pending: the app waits on HDMI rather than exiting.
const c=rig({});c.xhrs[0].status=204;c.xhrs[0].onload();assert.equal(c.exited,0);assert.equal(timeouts(c).length,0);
// DEEP_LINK payload skips the relay request.
const b=rig({payload:{camera:'entrance',hdmi:2}});assert.equal(b.xhrs.length,0);assert(b.calls.some(x=>x[0]==='setSource'&&x[2]===2));
console.log('PASS: Tizen HDMI behind page at startup, pending poll, PIP hidden until first frame, countdown from first frame, no-picture timeout, no exit at timer end, HA relaunch does not interrupt, BACK hides then exits, DEEP_LINK payload');
