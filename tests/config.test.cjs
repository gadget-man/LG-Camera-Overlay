// SPDX-License-Identifier: GPL-3.0-only
const {test}=require('node:test'),assert=require('node:assert/strict'),{validate}=require('../relay/config.cjs');
const good=()=>({port:8766,token:'a'.repeat(64),ffmpeg:'ffmpeg',sources:{entrance:'rtsp://192.0.2.20/feed'},tvs:{lounge:{host:'192.0.2.30',port:9922,username:'prisoner',privateKey:'private/lounge-key',passphrase:'test',hostKeySha256:'b'.repeat(64)}}});
test('portable software default and valid private config',()=>assert.equal(validate(good()).hardwareDecode,'none'));
test('reject weak token, unsupported input, path escape and unpinned host without leaking values',()=>{
 for(const change of [c=>c.token='secret',c=>c.sources.entrance='https://user:secret@example.com/feed',c=>c.tvs.lounge.privateKey='private/../../secret',c=>c.tvs.lounge.hostKeySha256='',c=>c.port=80,c=>c.tvs={},c=>c.sources={...c.sources,'bad/id':'rtsp://example.com/a'}]){const c=good();change(c);assert.throws(()=>validate(c),e=>!e.message.includes('secret'));}
});
test('Tizen TV needs no SSH pairing but requires a LAN listener',()=>{
 const c=good();c.tvs.lounge={platform:'tizen',hdmi:1};
 assert.throws(()=>validate(c),/listenHost/);
 c.listenHost='0.0.0.0';assert.equal(validate(c).tvs.lounge.platform,'tizen');
 for(const change of [c=>c.tvs.lounge.hdmi=9,c=>c.tvs.lounge.platform='android',c=>c.listenHost='relay.local']){const d=structuredClone(c);change(d);assert.throws(()=>validate(d));}
});
