const fs = require('fs');
const path = require('path');

const exampleDir = path.join(__dirname, '..');
const cliDir = path.join(
  exampleDir,
  'node_modules',
  '@react-native-oh',
  'react-native-harmony-cli',
);
const cliHarmonyDir = path.join(cliDir, 'harmony');
const hvigorConfigPath = path.join(
  exampleDir,
  'harmony',
  'hvigor',
  'hvigor-config.json5',
);

let cliVersion;
try {
  cliVersion = require(path.join(cliDir, 'package.json')).version;
} catch (e) {
  console.warn(
    '[sync-hvigor-plugin] @react-native-oh/react-native-harmony-cli is not installed, skip. Run "npm i" first.',
  );
  process.exit(0);
}

let tgzName;
const candidates = fs.existsSync(cliHarmonyDir)
  ? fs
      .readdirSync(cliHarmonyDir)
      .filter((name) => /^rnoh-hvigor-plugin-.*\.tgz$/.test(name))
  : [];
// The tgz is named after the plugin's own version, which may differ from the
// CLI version suffix, e.g. CLI "0.77.18-1" ships "rnoh-hvigor-plugin-0.77.18.tgz".
tgzName = candidates.find((name) => name === `rnoh-hvigor-plugin-${cliVersion}.tgz`);
if (!tgzName) {
  const baseVersion = cliVersion.split('-')[0];
  tgzName = candidates.find((name) => name === `rnoh-hvigor-plugin-${baseVersion}.tgz`);
}
if (!tgzName && candidates.length === 1) {
  tgzName = candidates[0];
}
if (!tgzName) {
  console.warn(
    `[sync-hvigor-plugin] No rnoh-hvigor-plugin tgz found for @react-native-oh/react-native-harmony-cli@${cliVersion} in ${cliHarmonyDir}, skip.`,
  );
  process.exit(0);
}

// Relative to example/harmony/hvigor/, which is where hvigor resolves "file:" specs from.
const spec = `file:../../node_modules/@react-native-oh/react-native-harmony-cli/harmony/${tgzName}`;

const content = fs.readFileSync(hvigorConfigPath, 'utf-8');
if (content.includes(spec)) {
  console.log(
    `[sync-hvigor-plugin] Already up to date: @rnoh/hvigor-plugin -> ${tgzName} (cli ${cliVersion})`,
  );
  process.exit(0);
}

const depRe = /(["'])@rnoh\/hvigor-plugin\1\s*:\s*(["'])[^"']*\2/;
let next;
if (depRe.test(content)) {
  next = content.replace(depRe, (m, q1, q2) =>
    `${q1}@rnoh/hvigor-plugin${q1}: ${q2}${spec}${q2}`,
  );
} else {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  if (/"dependencies"\s*:\s*\{\s*\}/.test(content)) {
    next = content.replace(
      /"dependencies"\s*:\s*\{\s*\}/,
      `"dependencies": {${eol}    "@rnoh/hvigor-plugin": "${spec}"${eol}  }`,
    );
  } else {
    next = content.replace(
      /"dependencies"\s*:\s*\{/,
      `"dependencies": {${eol}    "@rnoh/hvigor-plugin": "${spec}",`,
    );
  }
}

if (next === content) {
  console.error(
    `[sync-hvigor-plugin] Failed to update ${hvigorConfigPath}. Update "@rnoh/hvigor-plugin" manually to "${spec}".`,
  );
  process.exit(1);
}

fs.writeFileSync(hvigorConfigPath, next);
console.log(
  `[sync-hvigor-plugin] Updated @rnoh/hvigor-plugin -> ${tgzName} (cli ${cliVersion}) in harmony/hvigor/hvigor-config.json5`,
);
