const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

function writePushyBuildMetadata(moduleDir, projectDir, buildMode) {
  const rawDir = path.join(moduleDir, 'src/main/resources/rawfile');
  const release = buildMode.toLowerCase() === 'release';
  if (release) {
    const bundlePath = path.join(rawDir, 'bundle.harmony.js');
    if (!fs.existsSync(bundlePath)) {
      throw new Error('[pushy] Missing bundle.harmony.js. Run npm run prod in example before a release build.');
    }
    // This demo packages Metro JS. Check the prelude rather than an arbitrary
    // occurrence in application code, which may contain its own __DEV__ text.
    const prelude = fs.readFileSync(bundlePath, 'utf8').slice(0, 4096);
    const devFlag = prelude.match(/\b__DEV__\s*=\s*(true|false|!0|!1)(?=\s*[,;])/);
    if (!devFlag || !['false', '!1'].includes(devFlag[1])) {
      throw new Error('[pushy] Release requires a production JS bundle (__DEV__=false). Run npm run prod in example, then rebuild.');
    }
  }

  const app = JSON5.parse(fs.readFileSync(path.join(projectDir, 'AppScope/app.json5'), 'utf8')).app;
  if (typeof app?.versionName !== 'string' || !app.versionName.trim()) {
    throw new Error('[pushy] AppScope/app.json5 must define app.versionName.');
  }
  const meta = {
    pushy_build_time: release ? String(Date.now()) : '0',
    versionName: app.versionName,
  };
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

module.exports = { writePushyBuildMetadata };
