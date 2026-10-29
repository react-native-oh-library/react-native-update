#!/usr/bin/env node
// No shell interpolation: commands use executable + argument arrays.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const C = require('./pushy-flow/core.cjs');
const {Device} = require('./pushy-flow/device.cjs');
const project = path.resolve(__dirname, '..');
const root = path.resolve(project, '..');
const projectRequire = createRequire(path.join(project, 'package.json'));
const JSON5 = projectRequire('json5');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
const value = key => { const n=args.indexOf(key); return n<0?undefined:args[n+1]; };
const stage = value('--stage') || 'all';
const execute = args.includes('--execute');

async function main() {
  if (args.includes('--help')) {
    console.log('node scripts/pushy-flow.cjs --config pushy-flow.config.json --stage all|'+C.stages.join('|')+'|setup-cli|login [--execute]\nDefault: print plan only. --execute runs the selected stage. Completed stages resume from state.json. Use a NEW runId for a new run.');
    return;
  }
  assert(['all','setup-cli','login',...C.stages].includes(stage),'Unknown stage');
  const configFile=path.resolve(project,value('--config') || 'pushy-flow.config.json');
  const c=C.read(configFile);
  assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,70}$/.test(c.runId),'Use a unique runId (letters, digits, underscore, dash)');
  assert(c.appId && c.device && c.bundleName && c.ability,'Missing appId/device/bundleName/ability');
  assert.equal(c.cliVersion,'2.29.3','Internal CLI APIs are verified against 2.29.3 only');
  const dir=C.inside(path.join(root,'artifacts/pushy-flow'),c.runId);
  const selected=stage==='all'?C.stages:[stage];
  const describe={preflight:'Check CLI, login, signing configuration, SDK, appKey and device (read only)',
    baseline:'npm run prod + one Release assembleApp; archive and compare APP/HAP',
    install:'Install archived HAP and cold-start device',upload:'Upload native APP if not registered; verify server',
    'normal-build':'Build isolated healthy A fixture and PPK', 'normal-publish':'Publish A without binding',
    bind:'Bind A to this native package at 100%', 'normal-verify':'Download A, activate, mark success and cold-start',
    'rollback-build':'Build isolated B with autoMarkSuccess=false', 'rollback-publish':'Publish B without binding; verify isolation',
    'rollback-test':'Download/activate B, force-stop and cold-start; assert native rollback and unchanged bindings',
    'setup-cli':'Install pinned global CLI (changes global npm installation)',login:'Interactive Pushy CLI login; credentials stay in existing CLI credential file'};
  console.log(`Run: ${c.runId}\nOutput: ${dir}\n${execute?'EXECUTE':'PLAN ONLY'}`);
  for(const s of selected) console.log(`${s}: ${describe[s]}`);
  if(!execute) return;

  const commandEnv={...process.env,...(c.env || {})};
  const devHome=c.devecoHome || process.env.DEVECO_HOME;
  if(devHome) {
    for(const [key,relative] of [['JAVA_HOME','jbr'],['DEVECO_SDK_HOME','sdk'],['OHPM_HOME','tools/ohpm']]) {
      const candidate=path.join(devHome,relative);
      if(!commandEnv[key] && fs.existsSync(candidate)) commandEnv[key]=candidate;
    }
    const pathKey=Object.keys(commandEnv).find(k=>k.toUpperCase()==='PATH') || 'PATH';
    commandEnv[pathKey]=[path.join(devHome,'tools/node'),path.join(devHome,'tools/ohpm/bin'),commandEnv[pathKey] || ''].join(path.delimiter);
  }
  // npm scripts resolve node through PATH; keep Metro on this runtime rather than DevEco's older Node.
  const nodePathKey=Object.keys(commandEnv).find(k=>k.toUpperCase()==='PATH') || 'PATH';
  commandEnv[nodePathKey]=[path.dirname(process.execPath),commandEnv[nodePathKey] || ''].join(path.delimiter);
  const run=(exe,argv,cwd=project,timeout=30*60*1000)=>execFileSync(exe,argv,{cwd,env:commandEnv,stdio:'inherit',windowsHide:true,timeout});
  const npmCli=c.npmCli ? path.resolve(root,c.npmCli) : path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  if(stage==='setup-cli') { run(process.execPath,[npmCli,'install','-g',`react-native-update-cli@${c.cliVersion}`]); return; }
  const cliRoot=c.cliRoot ? path.resolve(root,c.cliRoot) : path.join(path.dirname(process.execPath),'node_modules/react-native-update-cli');
  assert.equal(C.read(path.join(cliRoot,'package.json')).version,c.cliVersion,'CLI version mismatch; run setup-cli');
  const cliRequire=file=>require(path.join(cliRoot,'lib',file));
  process.chdir(project);
  // Use the same alias validation as the existing project wrapper, also when a custom CLI root is configured.
  const deps=cliRequire('utils/dep-versions.js');
  const installed=projectRequire('@react-native-ohos/react-native-update/package.json');
  assert.equal(installed.harmony.alias,'react-native-update','Unexpected SDK alias');
  const originalDeps=deps.getDepVersions;
  const declared=originalDeps();
  assert.equal(declared[installed.name],installed.version,'Installed SDK metadata mismatch');
  deps.getDepVersions=()=>({...originalDeps(),'react-native-update':installed.version});
  const api=cliRequire('api.js');
  await api.loadSession();
  const commands=cliRequire('commands.js');
  const command=(name,options={},commandArgs=[])=>commands.loadCommandHandler(name)({args:commandArgs,
    options:{platform:'harmony','no-interactive':true,...options}});
  if(stage==='login') { await commands.loadCommandHandler('login')({args:[],options:{}}); return; }
  assert(api.getSession() || api.getApiToken(),'No login session: run --stage login --execute first');
  const app=C.read(path.join(project,'update.json')).harmony;
  assert.equal(String(app.appId),String(c.appId),'Config appId differs from example/update.json');
  fs.mkdirSync(dir,{recursive:true});
  const lock=path.join(dir,'running.lock');
  const lockFd=fs.openSync(lock,'wx');
  fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));
  const stateFile=path.join(dir,'state.json');
  const fingerprint=C.hash(JSON.stringify(c));
  let state;
  try {
    state=fs.existsSync(stateFile)?C.read(stateFile):{runId:c.runId,configHash:fingerprint,appId:c.appId,steps:{}};
    assert.equal(state.configHash,fingerprint,'Configuration changed for this runId; use a new runId');
    for(const receipt of Object.values(state.steps)) for(const file of receipt.files || [])
      assert.equal(C.sha(file.path),file.sha256,`Archived artifact changed: ${file.path}`);
    const out=(name,data)=>{C.save(path.join(dir,name),data);return data;};
    const fileReceipt=paths=>paths.map(file=>({path:file,sha256:C.sha(file)}));
    const need=s=>{assert(state.steps[s],`Run ${s} first`);return state.steps[s].result;};
    const source=path.join(project,'src/index.tsx');
    const poll=async(fn,label)=>{
      const end=Date.now()+(c.serverTimeoutMs || 120000);
      while(Date.now()<end){const result=await fn();if(result)return result;await sleep(3000);}
      throw new Error(`Timed out: ${label}`);
    };
    const packages=()=>api.getAllPackages(String(c.appId));
    const deviceDir=label=>{const d=path.join(dir,label+'-'+Date.now());fs.mkdirSync(d);return d;};
    const utilities=cliRequire('utils/index.js');
    const nativeInfo=async(file)=>{
      const info=await utilities.getAppInfo(file);
      const {bundleFile,...meta}=info;
      assert(/\b__DEV__\s*=\s*(?:false|!1)(?=\s*[,;])/.test(bundleFile.toString('utf8',0,4096)), 'Native archive contains non-production JS');
      assert(meta.buildTime && String(meta.buildTime)!=='0','Missing Release buildTime');
      if(meta.appId) assert.equal(String(meta.appId),String(app.appId));
      if(meta.appKey) assert.equal(meta.appKey,app.appKey);
      return meta;
    };
    const rawMap=async(file)=>{
      const entries={};
      await cliRequire('utils/zip-entries.js').enumZipEntries(file,async(entry,z)=>{
        if(entry.fileName.startsWith('resources/rawfile/')&&!entry.fileName.endsWith('/'))
          entries[entry.fileName]=C.hash(await cliRequire('utils/zip-entries.js').readEntry(entry,z));
      });
      return Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b)));
    };
    const assertDeviceIdentity=nodes=>{
      const base=need('baseline').info;
      for(const [label,want] of [['packageVersion',base.versionName],['buildTime',base.buildTime]]) {
        const node=nodes.find(n=>(n.text || '').startsWith(label+':'));
        assert(node && node.text.split(':').slice(1).join(':').trim()===String(want),`Device ${label} mismatch`);
      }
    };
    const published=async(kind)=>{
      const built=need(kind+'-build');
      const name=`${need('baseline').info.versionName}-${kind}-${c.runId}`;
      const versions=cliRequire('versions.js');
      const find=()=>versions.findVersion(String(c.appId),v=>v.name===name);
      let v=await find();
      if(!v) {
        await command('publish',{name,description:kind==='rollback'?'UNBOUND rollback test; autoMarkSuccess=false':`Healthy automation fixture ${c.runId}`,sourcemap:built.map},[built.ppk]);
        v=await poll(find,'published version');
      }
      assert(v.hash && v.id,'Missing version id/hash');
      // Never adopt an unrelated same-name version when recovering an interrupted publish.
      const url=`https://dl.reactnative.cn/${v.hash}`;
      const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
      assert(response.ok,`CDN HTTP ${response.status}`);
      assert.equal(C.hash(Buffer.from(await response.arrayBuffer())),C.sha(built.ppk),'Server version differs from local PPK');
      if(kind==='rollback') C.assertUnbound(await packages(),v.id);
      return out(kind+'-published.json',{id:v.id,name:v.name,hash:v.hash,url,bundleHash:built.bundleHash,ppkSha256:C.sha(built.ppk)});
    };
    const buildFixture=async(kind)=>{
      need('baseline');
      assert.equal(C.sha(source),state.sourceHash,'Source changed during this run; start a new runId');
      const generated=C.inside(path.join(project,'.pushy/automation'),c.runId+'/'+kind);
      fs.mkdirSync(generated,{recursive:true});
      const marker=`OTA-${kind==='normal'?'A':'B-ROLLBACK'}-${c.runId}`;
      fs.writeFileSync(path.join(generated,'Demo.tsx'),C.fixture(fs.readFileSync(source,'utf8'),marker,app.appKey,kind==='rollback'));
      const appPath=path.relative(generated,path.join(project,'app.json')).replaceAll('\\','/');
      fs.writeFileSync(path.join(generated,'entry.js'),`import {AppRegistry} from 'react-native';\nimport {name} from ${JSON.stringify(appPath)};\nimport Demo from './Demo';\nAppRegistry.registerComponent(name, () => Demo);\n`);
      const output=path.join(dir,kind);fs.mkdirSync(output,{recursive:true});
      const intermedia=path.join(output,'intermedia');fs.mkdirSync(intermedia,{recursive:true});
      const bundle=path.join(intermedia,'bundle.harmony.js');
      run(process.execPath,[path.join(project,'node_modules/react-native/cli.js'),'bundle-harmony','--entry-file',path.relative(project,path.join(generated,'entry.js')),
        '--bundle-output',bundle,'--assets-dest',intermedia,'--sourcemap-output',bundle+'.map','--dev','false','--minify','true']);
      const ppk=path.join(output,'harmony.ppk');
      await cliRequire('bundle-pack.js').packBundle(intermedia,ppk,'bundle.harmony.js');
      fs.copyFileSync(path.join(generated,'Demo.tsx'),path.join(output,'fixture.tsx'));
      return {result:{ppk,map:bundle+'.map',bundleHash:C.sha(bundle),marker},files:fileReceipt([ppk,bundle+'.map',path.join(output,'fixture.tsx')])};
    };
    const handlers={
      preflight:async()=>{
        assert(fs.existsSync(path.join(project,'harmony/entry/oh_modules')),'Sync Harmony dependencies in DevEco first');
        const profile=JSON5.parse(fs.readFileSync(path.join(project,'harmony/build-profile.json5'),'utf8'));
        const product=profile.app.products.find(p=>p.name===c.product);
        assert(product && profile.app.signingConfigs.some(s=>s.name===product.signingConfig),'Configure matching signing profile in DevEco first');
        const devHome=c.devecoHome || process.env.DEVECO_HOME;
        assert(devHome,'Set devecoHome or DEVECO_HOME');
        assert(fs.existsSync(path.join(devHome,'tools/hvigor/bin/hvigorw.js')),'hvigorw.js missing');
        const d=new Device(c,deviceDir('preflight'));
        assert(d.hdc('shell','echo','pushy-flow').includes('pushy-flow'),'Device unavailable');
        const text=fs.readFileSync(source,'utf8');
        assert(text.includes(JSON.stringify(app.appKey))||text.includes("'"+app.appKey+"'"),'Demo appKey differs from update.json');
        C.fixture(text,'preflight',app.appKey,false);
        await packages();
        state.sourceHash=C.sha(source);
        return {result:{cliVersion:c.cliVersion,sdk:installed.version,appId:c.appId,device:c.device}};
      },
      baseline:async()=>{
        if(!state.steps.preflight)throw new Error('Run preflight first');
        run(process.execPath,[npmCli,'run','prod']);
        const started=Date.now();
        const devHome=c.devecoHome || process.env.DEVECO_HOME;
        run(c.hvigorNode || path.join(devHome,'tools/node/node.exe'),[path.join(devHome,'tools/hvigor/bin/hvigorw.js'),
          '--mode','project','-p',`product=${c.product}`,'-p','buildMode=release','assembleApp','--no-daemon'],path.join(project,'harmony'));
        const sourceApp=path.resolve(project,c.appOutput),sourceHap=path.resolve(project,c.hapOutput);
        for(const f of [sourceApp,sourceHap]) assert(fs.statSync(f).mtimeMs>=started-2000,`Stale build output: ${f}`);
        const target=path.join(dir,'baseline');fs.mkdirSync(target,{recursive:true});
        const appFile=path.join(target,'baseline.app'),hapFile=path.join(target,'baseline.hap');
        fs.copyFileSync(sourceApp,appFile);fs.copyFileSync(sourceHap,hapFile);
        const info=await nativeInfo(appFile),hapInfo=await nativeInfo(hapFile);
        C.sameBaseline(info,hapInfo);
        assert.deepEqual(await rawMap(appFile),await rawMap(hapFile),'APP/HAP raw resources differ');
        const manifest=JSON5.parse(fs.readFileSync(path.join(project,'harmony/AppScope/app.json5'),'utf8')).app;
        assert.equal(manifest.bundleName,c.bundleName);
        assert.equal(info.versionName,manifest.versionName);
        out('baseline-info.json',info);
        return {result:{appFile,hapFile,info},files:fileReceipt([appFile,hapFile])};
      },
      install:async()=>{
        const baseline=need('baseline');
        const evidenceDir=deviceDir('install');const d=new Device(c,evidenceDir);
        const output=d.hdc('install','-r',baseline.hapFile);assert(/success/i.test(output),'HAP installation failed');
        await d.coldStart();
        const nodes=d.dump('installed');assertDeviceIdentity(nodes);
        const running=C.currentHash(nodes);d.snapshot('installed');
        // Do not delete existing user update data just to force a packaged-bundle launch.
        return {result:{evidenceDir,packageVersion:baseline.info.versionName,buildTime:baseline.info.buildTime,currentHash:running}};
      },
      upload:async()=>{
        const b=need('baseline');
        const find=async()=> (await packages()).find(p=>p.name===b.info.versionName&&String(p.buildTime)===String(b.info.buildTime));
        let pkg=await find();
        if(!pkg) { await command('uploadApp',{},[b.appFile]);pkg=await poll(find,'native registration'); }
        pkg=await poll(async()=>{const p=await find();return p?.status==='normal'?p:null;},'native package normal status');
        if(pkg.bundleHash) assert.equal(pkg.bundleHash,b.info.bundleHash,'Server bundle identity differs');
        return {result:out('native-registration.json',{id:pkg.id,name:pkg.name,buildTime:pkg.buildTime,bundleHash:b.info.bundleHash,status:pkg.status})};
      },
      'normal-build':()=>buildFixture('normal'),
      'normal-publish':async()=>({result:await published('normal')}),
      bind:async()=>{
        const normal=need('normal-publish'),pkgId=need('upload').id;
        const bound=async()=> (await packages()).find(p=>p.id===pkgId)?.bindings?.find(b=>b.versions?.id===normal.id&&b.type==='full');
        if(!await bound())await command('update',{versionId:String(normal.id),packageId:String(pkgId),rollout:100});
        return {result:out('normal-binding.json',await poll(bound,'full normal binding'))};
      },
      'normal-verify':async()=>{
        const evidenceDir=deviceDir('normal');const d=new Device(c,evidenceDir);
        const result=await d.healthy(need('normal-publish'));
        assertDeviceIdentity(d.dump('identity'));
        return {result:{...result,evidenceDir}};
      },
      'rollback-build':()=>buildFixture('rollback'),
      'rollback-publish':async()=>({result:await published('rollback')}),
      'rollback-test':async()=>{
        const normal=need('normal-publish'),bad=need('rollback-publish');
        const before=await packages();C.assertUnbound(before,bad.id);
        const pkgId=need('upload').id;
        assert(before.find(p=>p.id===pkgId)?.bindings?.some(b=>b.versions?.id===normal.id&&b.type==='full'),'Healthy binding changed');
        const evidenceDir=deviceDir('rollback');const d=new Device(c,evidenceDir);
        await d.coldStart();assertDeviceIdentity(d.dump('identity'));
        let result;
        try { result=await d.rollback(normal,bad); }
        catch(error) {
          // Recovery does not turn a failed/uncertain rollback into PASS.
          const failure={result:'FAIL',at:new Date().toISOString(),error:error.message,evidenceDir};
          try { failure.recovery=await d.healthy(normal); }
          catch(recoveryError) { failure.recoveryError=recoveryError.message; }
          out('verification.json',failure);
          throw error;
        }
        const after=await packages();C.assertUnbound(after,bad.id);
        assert.deepEqual(after.find(p=>p.id===pkgId)?.bindings,before.find(p=>p.id===pkgId)?.bindings,'Bindings changed during test');
        C.save(path.join(evidenceDir,'server-before.json'),before);
        C.save(path.join(evidenceDir,'server-after.json'),after);
        return {result:out('verification.json',{result:'PASS',at:new Date().toISOString(),...result,evidenceDir,testUnbound:true,normal,bad})};
      },
    };
    for(const s of selected) {
      if(state.steps[s]) {console.log(`[skip] ${s} completed; use new runId for a fresh full run`);continue;}
      for(const dep of C.dependencies[s] || []) need(dep);
      console.log(`[start] ${s}`);
      state.activeStage=s;C.save(stateFile,state);
      const receipt=await handlers[s]();
      state.steps[s]={at:new Date().toISOString(),...receipt};delete state.activeStage;delete state.lastError;
      C.save(stateFile,state);console.log(`[done] ${s}`);
    }
  } catch(e) {
    if(state) {state.lastError={at:new Date().toISOString(),stage:state.activeStage,message:e.message};C.save(stateFile,state);}
    throw e;
  } finally { fs.closeSync(lockFd);fs.unlinkSync(lock); }
}
main().catch(e=>{console.error('FAILED: '+e.message);process.exitCode=1;});
