// Official CLI adapter for this Harmony fork's package name. Report its actual
// installed version under the upstream dependency key required by Pushy.
const path = require('node:path');
const cliRoot = path.join(__dirname, 'node_modules/react-native-update-cli');
const versions = require(path.join(cliRoot, 'lib/utils/dep-versions.js'));
const originalGetVersions = versions.getDepVersions;
const originalGetVersion = versions.getDepVersion;
const harmonyPackage = '@react-native-ohos/react-native-update';
versions.getDepVersions = () => {
  const deps = originalGetVersions();
  if (!deps['react-native-update'] && deps[harmonyPackage]) {
    return { ...deps, 'react-native-update': deps[harmonyPackage] };
  }
  return deps;
};
versions.getDepVersion = (name, cwd) =>
  originalGetVersion(name, cwd) ??
  (name === 'react-native-update'
    ? originalGetVersion(harmonyPackage, cwd)
    : undefined);
process.env.RNU_DISABLE_AUTO_UPDATE = '1';
require(path.join(cliRoot, 'lib/bin.js'));
