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
// Relay-supplied request: fetch pending, switch to HDMI 1 behind the page, then stream.
const a=rig({});assert.equal(a.xhrs.length,1);assert.equal(a.xhrs[0].url,'http://192.0.2.10:8766/pending/t0k/lounge');
a.xhrs[0].status=200;a.xhrs[0].responseText=JSON.stringify({camera:'entrance',label:'Front door',duration:30,width:40});a.xhrs[0].onload();
assert.deepEqual(a.calls,[['setSource','HDMI',1],['show','0px,0px,100%,100%','MAIN','BEHIND']]);
assert.equal(a.options.url,'ws://192.0.2.10:8766/live/t0k/entrance/lounge');assert.equal(a.options.audio,false);
assert.equal(a.nodes.panel.style.width,'40%');assert.equal(a.nodes.label.textContent,'Front door');
assert.equal([...a.timers.values()].find(t=>t.type==='timeout').t,30000);
a.handlers.keydown({keyCode:10009,preventDefault(){}});assert.equal(a.exited,1);assert.equal(a.destroyed,1);assert.equal(a.timers.size,0);
// Relaunch while running replaces the session; an already-selected HDMI input is not switched again.
a.handlers.appcontrol();a.xhrs[1].status=200;a.xhrs[1].responseText=JSON.stringify({camera:'garage',hdmi:1});a.xhrs[1].onload();
assert.equal(a.calls.filter(c=>c[0]==='setSource').length,1);assert.equal(a.options.url,'ws://192.0.2.10:8766/live/t0k/garage/lounge');
// A stale response from a replaced launch is ignored.
a.handlers.appcontrol();const stale=a.xhrs[2];a.handlers.appcontrol();stale.status=200;stale.responseText='{"camera":"x"}';stale.onload();assert(stale.aborted);assert.equal(a.options.url,'ws://192.0.2.10:8766/live/t0k/garage/lounge');
// DEEP_LINK payload skips the relay request; nothing requested closes after 8 s.
const b=rig({payload:{camera:'entrance',hdmi:2}});assert.equal(b.xhrs.length,0);assert.deepEqual(b.calls[0],['setSource','HDMI',2]);
const c=rig({});c.xhrs[0].status=204;c.xhrs[0].onload();assert.equal(c.nodes.message.textContent,'No camera was requested');[...c.timers.values()][0].f();assert.equal(c.exited,1);
// Leaving the app (Home, source change) stops video and exits.
console.log('PASS: Tizen pending fetch, HDMI behind page, stream URL, BACK exit, relaunch replacement, stale response, DEEP_LINK payload, empty launch');
