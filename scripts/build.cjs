// SPDX-License-Identifier: GPL-3.0-only
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'.build',process.argv.includes('--test')?'test':'release');
// Keep each build isolated so old artifacts cannot enter the TV package.
fs.mkdirSync(stage,{recursive:true});
const appStage=fs.mkdtempSync(path.join(stage,'app-'));
fs.cpSync(path.join(root,'source'),appStage,{recursive:true});
const meta=JSON.parse(fs.readFileSync(path.join(appStage,'appinfo.json')));
if(process.argv.includes('--test')){meta.id='com.mbs.cameraoverlaytest';meta.title='Camera Overlay Test';}
fs.writeFileSync(path.join(appStage,'appinfo.json'),JSON.stringify(meta,null,2)+'\n');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const cli=path.join(root,'tooling/node_modules/@webos-tools/cli/bin/ares-package');
const run=spawnSync(process.execPath,[cli,'--no-minify',appStage,'-o',path.join(root,'dist')],{stdio:'inherit'});process.exitCode=run.status===null?1:run.status;if(run.error)throw run.error;
