// SPDX-License-Identifier: GPL-3.0-only
'use strict';
// Usage: node scripts/build-tizen.cjs --tv lounge --relay http://192.168.1.10:8766 [--profile NAME]
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.build','tizen'),dist=path.join(root,'dist');
const arg=name=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:undefined;};
const {conf}=require('../relay/config.cjs').load(),tvId=arg('tv'),relay=(arg('relay')||'').replace(/\/+$/,'');
if(!tvId||conf.tvs[tvId]?.platform!=='tizen')throw Error('--tv must name a Tizen TV in private/config.json');
if(!/^http:\/\/[^\s/]+:\d+$/.test(relay))throw Error('--relay must look like http://192.168.1.10:8766');
fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
fs.cpSync(path.join(root,'tizen'),stage,{recursive:true,filter:p=>!p.endsWith('overlay-config.example.js')});
const settings={relay,token:conf.token,tvId,hdmi:conf.tvs[tvId].hdmi??1};
fs.writeFileSync(path.join(stage,'overlay-config.js'),'window.OVERLAY_CONFIG='+JSON.stringify(settings)+';\n',{mode:0o600});
console.log('Staged '+stage);
const tizen=process.env.TIZEN_CLI||'tizen',profile=arg('profile');
if(!profile){console.log('Add --profile <certificate profile> to package with the Tizen Studio CLI.');return;}
fs.mkdirSync(dist,{recursive:true});
const run=spawnSync(tizen,['package','-t','wgt','-s',profile,'-o',dist,'--',stage],{stdio:'inherit',shell:process.platform==='win32'});
if(run.error)throw Error('Tizen CLI not found; install Tizen Studio or set TIZEN_CLI');
// A CLI stopped by a signal has no exit status: treat that as a failure too (as scripts/build.cjs does).
if(run.status!==0){process.exitCode=run.status===null?1:run.status;return;}
// tizen install fails without a reason when the package file name contains a space, and the CLI names
// the file after <name> in config.xml ("Camera Overlay.wgt"), so rename it to a space-free name.
for(const file of fs.readdirSync(dist))if(file.endsWith('.wgt')&&/\s/.test(file)){
 const target=file.replace(/\s+/g,'');fs.rmSync(path.join(dist,target),{force:true});fs.renameSync(path.join(dist,file),path.join(dist,target));
 console.log('Renamed package to '+path.join(dist,target));
}
