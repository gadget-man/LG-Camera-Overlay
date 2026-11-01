// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert"),{EventEmitter}=require("events");
const source=fs.readFileSync("relay/relay.cjs","utf8"),token="a".repeat(64);
const config={port:8766,listenHost:"0.0.0.0",token,hardwareDecode:"none",ffmpeg:"ffmpeg",renewDeveloperMode:true,sources:{entrance:"fake"},tvs:{lounge:{platform:"tizen",hdmi:1}}};
let handler,listened,ssh=0,devmode=0,spawned=[];
const server=new EventEmitter();server.listen=(port,host,fn)=>{listened=host;fn();};
const ctx=vm.createContext({__dirname:"/test",require:n=>({"fs":{readFileSync:p=>p.endsWith("timing.json")?"[]":"",writeFileSync(){},renameSync(){}},"path":require("path"),"crypto":require("crypto"),"http":{createServer:f=>{handler=f;return server}},"net":{},"child_process":{spawn(cmd,args){const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>{c.killed=true};c.pid=1;spawned.push({args,c});return c;}},"ws":{WebSocketServer:class extends EventEmitter{}},"ssh2":{Client:class{constructor(){ssh++}}},"./config.cjs":{load:()=>({root:"/test",conf:config})},"./devmode.cjs":{run:async()=>{devmode++}}}[n]),console:{log(){}},process:{on(){},memoryUsage:()=>({rss:0}),exit(){}},setTimeout:(fn,d)=>({fn,d,unref(){return this}}),clearTimeout(){},Date,JSON,Number,Set,Map,Buffer});
vm.runInContext(source,ctx);
function call(method,url,body){
 const req=new EventEmitter();req.method=method;req.url=url;req.destroy=()=>{};
 const res={headers:{},writeHead(s,h){this.status=s;Object.assign(this.headers,h||{})},end(b){this.body=b;this.writableEnded=true}};
 handler(req,res);if(body!==undefined){req.emit("data",body);req.emit("end");}return res;
}
assert.equal(listened,"0.0.0.0");assert.equal(ssh,0,"Tizen TVs must not open SSH");assert.equal(devmode,0);
assert.equal(vm.runInContext("tvs.get('lounge').ready",ctx),true);
assert.equal(call("GET","/pending/"+token+"/lounge").status,204);
assert.equal(call("POST","/show/wrong/lounge","{}").status,403);
assert.equal(call("POST","/show/"+token+"/kitchen","{}").status,403);
assert.equal(call("POST","/show/"+token+"/lounge",JSON.stringify({camera:"nope"})).status,400);
assert.equal(call("POST","/show/"+token+"/lounge","not json").status,400);
assert.equal(call("POST","/show/"+token+"/lounge",JSON.stringify({camera:"entrance",label:"Door",duration:"30",width:99,stream:"ws://evil/x"})).status,204);
const got=call("GET","/pending/"+token+"/lounge");assert.equal(got.status,200);assert.equal(got.headers["Access-Control-Allow-Origin"],"*");
const p=JSON.parse(got.body);assert.equal(p.camera,"entrance");assert.equal(p.duration,30);assert.equal(p.width,55);assert.equal(p.hdmi,1);assert.equal(p.stream,undefined,"Callers must not inject a stream URL");
assert.equal(call("GET","/pending/"+token+"/lounge").status,204,"A request is consumed once");
assert.equal(spawned.length,1,"A show request starts the camera feed before the TV connects");assert(spawned[0].args.includes("-probesize"),"Fast stream probe");
assert.equal(vm.runInContext("streams.has('entrance')",ctx),true);
vm.runInContext("pending.set('lounge',{camera:'entrance',sentAt:Date.now()-61000})",ctx);assert.equal(call("GET","/pending/"+token+"/lounge").status,204,"Old requests expire");
console.log("PASS: Tizen TV skips SSH/devmode, LAN listener, token and TV checks, sanitized one-shot show requests with expiry");
