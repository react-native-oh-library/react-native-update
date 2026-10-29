const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const stages = ['preflight', 'baseline', 'install', 'upload', 'normal-build',
  'normal-publish', 'bind', 'normal-verify', 'rollback-build', 'rollback-publish', 'rollback-test'];
const dependencies = {
  install: ['baseline'], upload: ['baseline'], 'normal-build': ['baseline'],
  'normal-publish': ['normal-build', 'upload'], bind: ['normal-publish', 'upload'],
  'normal-verify': ['install', 'bind'], 'rollback-build': ['normal-build'],
  'rollback-publish': ['rollback-build', 'upload'],
  'rollback-test': ['normal-verify', 'rollback-publish'],
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sha = file => hash(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function save(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
function inside(root, relative) {
  const result = path.resolve(root, relative);
  const rel = path.relative(root, result);
  assert(rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel), 'Path must stay inside output root');
  return result;
}
function currentHash(nodes) {
  const node = nodes.find(n => /currentVersion[）)]/.test(n.text || ''));
  assert(node, 'Current running hash is not visible in layout');
  const value = node.text.split(/[:：]/).slice(1).join(':').trim();
  return /内置|packaged/.test(value) ? '' : value;
}
function fixture(source, marker, appKey, rollback) {
  const once = (pattern, replacement) => {
    assert.equal([...source.matchAll(new RegExp(pattern.source, 'g'))].length, 1, `Expected one fixture anchor: ${pattern}`);
    source = source.replace(pattern, replacement);
  };
  assert(!/autoMarkSuccess\s*:/.test(source), 'Source already defines autoMarkSuccess; review fixture anchors');
  once(/const PAGE_TITLE = '[^']*';/, `const PAGE_TITLE = ${JSON.stringify(marker)};`);
  once(/const DEFAULT_APPKEY = '[^']*';/, `const DEFAULT_APPKEY = ${JSON.stringify(appKey)};`);
  once(/appKey: initialAppKey,/, `appKey: initialAppKey,\n    autoMarkSuccess: ${!rollback},`);
  once(/debug: (?:true|false),/, 'debug: false,');
  once(/checkStrategy: [^,\n]+,/, 'checkStrategy: null,');
  once(/updateStrategy: [^,\n]+,/, 'updateStrategy: null,');
  return source;
}
function rollbackEvidence(log, pid, bad, good) {
  return log.split(/\r?\n/).find(line => line.includes(` ${pid} `) &&
    line.includes(`Version ${bad} was not marked as successful, rolled back to ${good}`));
}
function assertUnbound(packages, id) {
  assert(!packages.some(p => (p.bindings || []).some(b => String(b.versions?.id) === String(id))), 'Rollback version must remain unbound');
}
function sameBaseline(a, b) {
  for (const k of ['versionName', 'buildTime', 'bundleHash']) assert.equal(String(a[k]), String(b[k]), `APP/HAP mismatch: ${k}`);
}
module.exports = {stages, dependencies, hash, sha, read, save, inside, currentHash, fixture, rollbackEvidence, assertUnbound, sameBaseline};
