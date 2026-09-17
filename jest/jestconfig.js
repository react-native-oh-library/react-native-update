/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const babelJestTransform = [
  'babel-jest',
  {
    babelrc: false,
    configFile: false,
    presets: [
      ['@babel/preset-env', {targets: {node: 'current'}, modules: 'commonjs'}],
      ['@babel/preset-typescript', {allowNamespaces: true}],
      '@babel/preset-flow',
    ],
    plugins: ['@babel/plugin-transform-react-jsx'],
  },
];

module.exports = {
  testEnvironment: 'node',
  rootDir: './',
  roots: ['<rootDir>'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.[jt]sx?$': babelJestTransform,
  },
  testMatch: ['<rootDir>/_tests_/*-test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  globals: {
    __DEV__: true,
  },
  transformIgnorePatterns: ['/node_modules/'],
  watchman: false,
  collectCoverageFrom: [
    '<rootDir>/../src/error.ts',
    '<rootDir>/../src/updateFlowCore.ts',
    '<rootDir>/../src/utils.ts',
    '<rootDir>/../src/i18n.ts',
    '<rootDir>/../src/endpoint.ts',
    '<rootDir>/../src/metadata.ts',
    '<rootDir>/../src/index.ts',
    '<rootDir>/../src/core.ts',
    '<rootDir>/../harmony/update/src/main/ets/ErrorCodes.ts',
    '!<rootDir>/../src/**/*.d.ts',
    '!<rootDir>/../src/specs/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {branches: 60},
  },
  moduleNameMapper: {
    '^@oh-rn/react-native-update$': '<rootDir>/../src/index.ts',
    '^react-native$': '<rootDir>/rn-mock.js',
    '^react-native/Libraries/Core/ReactNativeVersion$':
      '<rootDir>/rn-version-mock.js',
  },
};
