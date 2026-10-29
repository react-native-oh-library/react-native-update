const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const C = require('./core.cjs');

test('fixture changes only isolated copy, disables success and automatic JS strategy for B',()=>{
  const original=fs.readFileSync(path.resolve(__dirname,'../../src/index.tsx'),'utf8');
  const b=C.fixture(original,'OTA-B-test','key-test',true);
  assert(b.includes('autoMarkSuccess: false'));
  assert(b.includes('updateStrategy: null'));
  assert(b.includes('checkStrategy: null'));
  assert(b.includes('const PAGE_TITLE = "OTA-B-test"'));
  assert(!original.includes('autoMarkSuccess: false'));
  assert(C.fixture(original,'OTA-A-test','key-test',false).includes('autoMarkSuccess: true'));
});
test('changed source anchors stop rather than silently producing a healthy rollback fixture',()=>{
  const original=fs.readFileSync(path.resolve(__dirname,'../../src/index.tsx'),'utf8');
  assert.throws(()=>C.fixture(original.replace('appKey: initialAppKey,','appKey: different,'),'B','key',true));
  assert.throws(()=>C.fixture(original+'\nconst extra = { autoMarkSuccess: true };','B','key',true));
});
test('currentHash ignores a target hash mentioned by update prompts and rejects missing identity',()=>{
  assert.equal(C.currentHash([{text:'new version hash: target'},{text:'当前运行 hash（currentVersion）: healthy'}]),'healthy');
  assert.equal(C.currentHash([{text:'当前运行 hash（currentVersion）: (内置包)'}]),'');
  assert.throws(()=>C.currentHash([{text:'versionInfo: healthy'}]));
});
test('rollback requires matching new process and exact old/new versions',()=>{
  const line='10-29 10:00:00 123 123 E pushy: Version bad was not marked as successful, rolled back to good';
  assert.equal(C.rollbackEvidence(line,'123','bad','good'),line);
  assert.equal(C.rollbackEvidence(line,'124','bad','good'),undefined);
  assert.equal(C.rollbackEvidence(line,'123','other','good'),undefined);
});
test('baseline mismatch and bound test package fail closed',()=>{
  const a={versionName:'1',buildTime:'10',bundleHash:'a'};
  C.sameBaseline(a,{...a});
  assert.throws(()=>C.sameBaseline(a,{...a,buildTime:'11'}));
  assert.throws(()=>C.sameBaseline(a,{...a,bundleHash:'b'}));
  C.assertUnbound([{bindings:[{versions:{id:1}}]}],2);
  assert.throws(()=>C.assertUnbound([{bindings:[{versions:{id:2}}]}],2));
});
test('output paths cannot escape run root',()=>{
  const root=path.join(os.tmpdir(),'pushy-flow-test');
  assert.equal(C.inside(root,'run/normal'),path.join(root,'run/normal'));
  for(const bad of ['../outside','..','.']) assert.throws(()=>C.inside(root,bad));
});
test('default all plan performs no filesystem/device/network mutations',()=>{
  const project=path.resolve(__dirname,'../..');
  const runId='plan-test-'+process.pid;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pushy-plan-'));
  try {
    const config={...C.read(path.join(project,'pushy-flow.config.json')),runId};
    const file=path.join(temp,'config.json');C.save(file,config);
    const output=execFileSync(process.execPath,[path.join(project,'scripts/pushy-flow.cjs'),'--config',file],{encoding:'utf8'});
    assert(output.includes('PLAN ONLY'));
    assert(output.includes('rollback-test'));
    assert(!fs.existsSync(path.resolve(project,'../artifacts/pushy-flow',runId)));
  } finally {
    // Known files in this test's own temporary directory only; no recursive deletion.
    fs.unlinkSync(path.join(temp,'config.json'));fs.rmdirSync(temp);
  }
});
