const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { writePushyBuildMetadata } = require('./pushy-build-metadata');

function fixture(t, bundle) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pushy-build-metadata-'));
  t.after(() => {
    // Only remove the temporary directory allocated by this test.
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('pushy-build-metadata-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const moduleDir = path.join(dir, 'entry');
  const rawDir = path.join(moduleDir, 'src/main/resources/rawfile');
  fs.mkdirSync(path.join(dir, 'AppScope'), { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AppScope/app.json5'), "{app: {versionName: '1.0.2',},}");
  if (bundle !== undefined) {
    fs.writeFileSync(path.join(rawDir, 'bundle.harmony.js'), bundle);
  }
  return { dir, moduleDir, metaFile: path.join(rawDir, 'meta.json') };
}

test('release metadata uses the native version and a nonzero millisecond timestamp', t => {
  const f = fixture(t, 'var __DEV__=false,process={};');
  const before = Date.now();
  const result = writePushyBuildMetadata(f.moduleDir, f.dir, 'release');
  assert.equal(result.versionName, '1.0.2');
  assert.ok(Number(result.pushy_build_time) >= before);
  assert.ok(Number(result.pushy_build_time) <= Date.now());
  assert.deepEqual(JSON.parse(fs.readFileSync(f.metaFile, 'utf8')), result);
});

test('a development bundle cannot overwrite existing release metadata', t => {
  const f = fixture(t, 'var __DEV__=true,process={};');
  fs.writeFileSync(f.metaFile, '{"pushy_build_time":"123"}');
  assert.throws(() => writePushyBuildMetadata(f.moduleDir, f.dir, 'release'), /npm run prod/);
  assert.equal(fs.readFileSync(f.metaFile, 'utf8'), '{"pushy_build_time":"123"}');
});

test('a missing bundle fails release validation before writing metadata', t => {
  const f = fixture(t);
  assert.throws(() => writePushyBuildMetadata(f.moduleDir, f.dir, 'release'), /Missing bundle/);
  assert.equal(fs.existsSync(f.metaFile), false);
});

test('debug builds using Metro can omit the offline bundle and use timestamp zero', t => {
  const f = fixture(t);
  assert.deepEqual(writePushyBuildMetadata(f.moduleDir, f.dir, 'debug'), {
    pushy_build_time: '0', versionName: '1.0.2',
  });
});

test('minified production prelude is accepted', t => {
  const f = fixture(t, 'var __DEV__=!1,process={};');
  assert.notEqual(writePushyBuildMetadata(f.moduleDir, f.dir, 'release').pushy_build_time, '0');
});

test('an unrecognized bundle is not assumed to be production', t => {
  const f = fixture(t, 'console.log("missing Metro prelude");');
  assert.throws(() => writePushyBuildMetadata(f.moduleDir, f.dir, 'release'), /production JS bundle/);
});
