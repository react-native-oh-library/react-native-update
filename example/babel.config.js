// RN >= 0.73 ships @react-native/babel-preset; the 0.72 setup uses
// metro-react-native-babel-preset instead. Pick whichever is installed.
let preset;
try {
  preset = require.resolve('@react-native/babel-preset');
} catch (e) {
  preset = require.resolve('metro-react-native-babel-preset');
}

module.exports = {
  presets: [preset],
  plugins: [
  ],
};
