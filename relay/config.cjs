// SPDX-License-Identifier: GPL-3.0-only
'use strict';
const fs=require('fs'),path=require('path');
function validate(c){
 const fail=field=>{throw Error('Invalid configuration: '+field);};
 if(!c||typeof c!=='object'||Array.isArray(c))fail('root');
 if(!Number.isInteger(c.port)||c.port<1024||c.port>65535)fail('port');
 if(typeof c.token!=='string'||!/^[a-f0-9]{64}$/.test(c.token))fail('token (generate 32 random bytes as hex)');
 if(typeof c.ffmpeg!=='string'||!c.ffmpeg.trim())fail('ffmpeg');
 c.hardwareDecode=c.hardwareDecode??'none';
 if(!['none','videotoolbox'].includes(c.hardwareDecode))fail('hardwareDecode');
 if(c.renewDeveloperMode!==undefined&&typeof c.renewDeveloperMode!=='boolean')fail('renewDeveloperMode');
 for(const group of ['sources','tvs']){
  if(!c[group]||typeof c[group]!=='object'||Array.isArray(c[group])||!Object.keys(c[group]).length||Object.keys(c[group]).length>16)fail(group);
  for(const id of Object.keys(c[group]))if(!/^[a-z][a-z0-9_]{0,40}$/.test(id))fail(group+' identifier');
 }
 for(const value of Object.values(c.sources)){
  try{const u=new URL(value);if(!['rtsp:','rtsps:'].includes(u.protocol)||!u.hostname||/[\r\n]/.test(value))fail('source URL');}catch{fail('source URL (RTSP or RTSPS required)');}
 }
 for(const tv of Object.values(c.tvs)){
  if(!tv||typeof tv!=='object')fail('TV');
  tv.platform=tv.platform??'webos';
  if(!['webos','tizen'].includes(tv.platform))fail('TV platform');
  if(tv.platform==='tizen'){
   // Tizen TVs have no SSH: the TV app connects straight to the relay's LAN listener.
   if(tv.hdmi!==undefined&&(!Number.isInteger(tv.hdmi)||tv.hdmi<0||tv.hdmi>4))fail('TV hdmi (0 keeps current source)');
   continue;
  }
  if(typeof tv.host!=='string'||!tv.host||/[\s/]/.test(tv.host))fail('TV host');
  if(!Number.isInteger(tv.port)||tv.port<1||tv.port>65535)fail('TV port');
  if(tv.username!=='prisoner')fail('TV username');
  if(typeof tv.privateKey!=='string'||!/^private\/[a-zA-Z0-9_-]+$/.test(tv.privateKey))fail('TV privateKey (private/name only)');
  if(typeof tv.passphrase!=='string')fail('TV passphrase');
  if(typeof tv.hostKeySha256!=='string'||!/^[a-f0-9]{64}$/.test(tv.hostKeySha256))fail('TV hostKeySha256');
 }
 c.listenHost=c.listenHost??'127.0.0.1';
 if(typeof c.listenHost!=='string'||!/^(?:\d{1,3}(?:\.\d{1,3}){3}|::|::1)$/.test(c.listenHost))fail('listenHost (IP address)');
 const tizen=Object.values(c.tvs).some(tv=>tv.platform==='tizen');
 if(tizen&&['127.0.0.1','::1'].includes(c.listenHost))fail('listenHost (Tizen TVs need a LAN address such as 0.0.0.0)');
 return c;
}
function load(){
 const root=path.resolve(process.env.OVERLAY_DATA_DIR||path.join(__dirname,'..'));
 let c;try{c=JSON.parse(fs.readFileSync(path.join(root,'private/config.json'),'utf8'));}catch{throw Error('Cannot read private/config.json; copy and complete config.example.json');}
 const conf=validate(c);fs.mkdirSync(path.join(root,'logs'),{recursive:true,mode:0o700});
 for(const tv of Object.values(conf.tvs)){if(tv.platform==='tizen')continue;try{fs.accessSync(path.join(root,tv.privateKey),fs.constants.R_OK);}catch{throw Error('Configured TV private key is not readable');}}
 return {root,conf};
}
module.exports={validate,load};
