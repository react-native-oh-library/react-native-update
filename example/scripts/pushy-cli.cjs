#!/usr/bin/env node
// Run the official CLI with the installed Harmony package's declared alias.
// Only dependency metadata is adapted; the APP and SDK version stay unchanged.
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
process.chdir(projectDir);

let cliRoot;
try {
  cliRoot = path.resolve(path.dirname(require.resolve('react-native-update-cli')), '..');
} catch {
  cliRoot = path.join(path.dirname(process.execPath), 'node_modules', 'react-native-update-cli');
}
const cliEntry = path.join(cliRoot, 'lib', 'bin.js');
if (!fs.existsSync(cliEntry)) {
  throw new Error('Pushy CLI not found. Run npm install -g react-native-update-cli.');
}

const depVersions = require(path.join(cliRoot, 'lib', 'utils', 'dep-versions.js'));
const getDepVersions = depVersions.getDepVersions;
const getDepVersion = depVersions.getDepVersion;
if (typeof getDepVersions !== 'function' || typeof getDepVersion !== 'function') {
  throw new Error('Unsupported Pushy CLI dependency metadata API. Review this adapter before uploading.');
}

const harmonyName = '@react-native-ohos/react-native-update';
const installedVersions = getDepVersions();
if (!installedVersions['react-native-update']) {
  const installedPackage = JSON.parse(fs.readFileSync(
    path.join(projectDir, 'node_modules', harmonyName, 'package.json'), 'utf8',
  ));
  if (installedPackage.name !== harmonyName ||
      installedPackage.harmony?.alias !== 'react-native-update' ||
      !installedVersions[harmonyName] ||
      installedVersions[harmonyName] !== installedPackage.version) {
    throw new Error('Cannot verify the installed Harmony SDK version and alias.');
  }
  depVersions.getDepVersions = () => ({
    ...getDepVersions(),
    'react-native-update': installedPackage.version,
  });
  depVersions.getDepVersion = (name, cwd) =>
    name === 'react-native-update' && (!cwd || path.resolve(cwd) === projectDir)
      ? installedPackage.version
      : getDepVersion(name, cwd);
  console.error(`[pushy alias] ${harmonyName}@${installedPackage.version} -> react-native-update (dependency metadata only)`);
}

process.argv[1] = cliEntry;
require(cliEntry);
