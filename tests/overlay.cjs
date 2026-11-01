const fs=require('fs'),vm=require('vm'),assert=require('assert');
const handlers={},timers=new Map(),nodes={};let id=0,destroyed=0,options,closed=0,clock=1700000000000;const sent=[];
for(const key of ['panel','camera','message','status','seconds','label'])nodes[key]={style:{},textContent:'',width:768,height:432};
const params={stream:'ws://192.0.2.10:8765/live/test',duration:45,width:42,label:'Gate',sentAt:1699999999000,detectedAt:1699999998500};
const context={document:{getElementById:k=>nodes[k],addEventListener:(k,f)=>handlers[k]=f},window:{PalmSystem:{launchParams:JSON.stringify(params)},addEventListener:(k,f)=>handlers[k]=f,close:()=>closed++},setTimeout:(f,t)=>{timers.set(++id,{f,t,type:'timeout'});return id},setInterval:(f,t)=>{timers.set(++id,{f,t,type:'interval'});return id},clearTimeout:i=>timers.delete(i),clearInterval:i=>timers.delete(i),Date:{now:()=>clock},JSON,Number,isFinite,JSMpeg:{Player:function(url,o){options=o;this.source={socket:{readyState:1,send:m=>sent.push(JSON.parse(m))}};this.destroy=()=>destroyed++;}}};
vm.runInNewContext(fs.readFileSync('source/app.js','utf8'),context);
assert.equal(nodes.panel.style.width,'42%');assert.equal(timers.size,2);assert.equal(options.audio,false);assert.equal(options.pauseWhenHidden,false);
assert.equal(nodes.panel.style.top,'3vw');assert.equal(nodes.panel.style.right,'3vw');assert.equal(nodes.panel.style.borderColor,'#67dfad');assert.equal(nodes.panel.style.borderWidth,'3px');assert.equal(nodes.panel.className,'');
clock+=2500;options.onVideoDecode();assert.equal(nodes.camera.style.visibility,'visible');assert.deepEqual(sent[0],{type:'started',appStartupMs:2500,sentAt:params.sentAt,detectedAt:params.detectedAt});options.onVideoDecode();assert.equal(sent.length,1);
const old=options.onVideoDecode;handlers.webOSRelaunch({detail:{launchParams:params}});assert.equal(destroyed,1);assert.equal(timers.size,2);
old();assert.equal(nodes.camera.style.visibility,'hidden');assert.equal(sent.length,1);clock+=1000;options.onVideoDecode();assert.equal(sent.length,2);assert.equal(sent[1].appStartupMs,1000);
handlers.keydown({keyCode:461,preventDefault:()=>{}});assert.equal(destroyed,2);assert.equal(timers.size,0);assert.equal(closed,1);
handlers.webOSRelaunch({detail:{stream:'file:///private',duration:999,width:999}});assert.equal(nodes.status.textContent,'No stream');assert.equal(nodes.panel.style.width,'55%');assert.equal(timers.size,1);
handlers.pagehide();assert.equal(timers.size,0);
handlers.webOSRelaunch({detail:{...params,position:'bottom-left',margin:0,border:false,borderColor:'#FF8800',compact:true}});assert.equal(nodes.panel.style.top,'auto');assert.equal(nodes.panel.style.bottom,'0vw');assert.equal(nodes.panel.style.left,'0vw');assert.equal(nodes.panel.style.borderWidth,'0');assert.equal(nodes.panel.style.borderColor,'#FF8800');assert.equal(nodes.panel.className,'compact');
clock+=100;options.onVideoDecode();[...timers.values()].find(t=>t.type==='interval').f();assert.equal(nodes.status.textContent,'LIVE · 1 fps');assert.equal(nodes.status.style.color,'#67dfad');
handlers.webOSRelaunch({detail:{...params,fps:false}});clock+=100;options.onVideoDecode();[...timers.values()].find(t=>t.type==='interval').f();assert.equal(nodes.status.textContent,'LIVE');
handlers.webOSRelaunch({detail:{...params,position:'center'}});assert.equal(nodes.panel.style.transform,'translate(-50%,-50%)');assert.equal(nodes.panel.className,'');
handlers.webOSRelaunch({detail:{...params,position:'center',margin:7}});assert.equal(nodes.panel.style.top,'50%');
handlers.webOSRelaunch({detail:{...params,position:'top-left',margin:'7'}});assert.equal(nodes.panel.style.left,'7vw');assert.equal(nodes.panel.style.top,'7vw');assert.equal(nodes.panel.style.right,'auto');
for(const position of ['constructor','__proto__','toString','hasOwnProperty']){handlers.webOSRelaunch({detail:{...params,position}});assert.equal(nodes.panel.style.top,'3vw');assert.equal(nodes.panel.style.right,'3vw');assert.equal(nodes.panel.style.bottom,'auto');assert.equal(nodes.panel.style.transform,'none');}
for(const margin of [2.5,'2.5',0.1,-1,11]){handlers.webOSRelaunch({detail:{...params,margin}});assert.equal(nodes.panel.style.right,'3vw');}
handlers.webOSRelaunch({detail:{...params,margin:'0'}});assert.equal(nodes.panel.style.right,'0vw');
handlers.webOSRelaunch({detail:{...params,position:'javascript:x',margin:'99;x',border:'no',borderColor:'red;background:url(x)',compact:'yes'}});assert.equal(nodes.panel.style.right,'3vw');assert.equal(nodes.panel.style.borderWidth,'3px');assert.equal(nodes.panel.style.transform,'none');assert.equal(nodes.panel.style.borderColor,'#67dfad');assert.equal(nodes.panel.className,'');
handlers.pagehide();assert.equal(timers.size,0);
handlers.webOSRelaunch({detail:params});const auto=[...timers.values()].find(t=>t.type==='timeout');assert.equal(auto.t,45000);auto.f();assert.equal(closed,2);assert.equal(timers.size,0);
console.log('PASS: first-frame timing once per session, live player lifecycle, relaunch cleanup, old-frame rejection, BACK, URL validation, size/duration bounds, position/margin/border/fps/compact styling and fallbacks (inherited names, fractional margins)');
