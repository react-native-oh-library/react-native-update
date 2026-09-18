/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const createPushyNativeModule = () => {
  const constants = {
    downloadRootDir: '/data/storage/el2/base/files/_update',
    packageVersion: '1.0.0',
    currentVersion: '',
    isFirstTime: false,
    rolledBackVersion: '',
    buildTime: '202601010000',
    uuid: 'test-uuid-001',
    isUsingBundleUrl: false,
    currentVersionInfo: '',
    supportedDiffVersion: 2,
    currentBundleSha256: '',
  };

  const hashInfoStore = {};
  const kvStore = {uuid: constants.uuid};

  return {
    ...constants,
    getConstants: jest.fn(() => ({...constants})),
    setLocalHashInfo: jest.fn(async (hash, info) => {
      hashInfoStore[hash] = info;
    }),
    getLocalHashInfo: jest.fn(async hash => hashInfoStore[hash] || ''),
    setUuid: jest.fn(async uuid => {
      kvStore.uuid = uuid;
    }),
    syncNativeConfig: jest.fn(async config => {
      JSON.parse(config);
      kvStore.config = config;
    }),
    getNativeCheckCache: jest.fn(async () => kvStore.respCache || ''),
    markJsCheckCompleted: jest.fn(async config => {
      if (!config) {
        throw new Error('[INVALID_OPTIONS] config must be a non-empty string');
      }
      kvStore.jsCheckCompleted = config;
    }),
    reloadUpdate: jest.fn(async () => {}),
    restartApp: jest.fn(async () => {}),
    setNeedUpdate: jest.fn(async () => {}),
    markSuccess: jest.fn(async () => {}),
    getBundleHash: jest.fn(async () => 'bundle-hash-mock'),
    resetToPackagedBundle: jest.fn(async () => {}),
    downloadPatchFromPpk: jest.fn(async () => {}),
    downloadPatchFromPackage: jest.fn(async () => {}),
    downloadFullUpdate: jest.fn(async () => {}),
    downloadAndInstallApk: jest.fn(async () => {
      throw new Error(
        '[UNSUPPORTED_PLATFORM] downloadAndInstallApk is only supported on Android',
      );
    }),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
    __hashInfoStore: hashInfoStore,
    __kvStore: kvStore,
    __constants: constants,
  };
};

const mockPushy = createPushyNativeModule();

class NativeEventEmitter {
  constructor() {
    this._listeners = {};
  }
  addListener(eventName, handler) {
    this._listeners[eventName] = this._listeners[eventName] || [];
    this._listeners[eventName].push(handler);
    return {
      remove: () => {
        this._listeners[eventName] = (this._listeners[eventName] || []).filter(
          item => item !== handler,
        );
      },
    };
  }
  emit(eventName, payload) {
    (this._listeners[eventName] || []).forEach(handler => handler(payload));
  }
  removeAllListeners(eventName) {
    if (eventName) {
      delete this._listeners[eventName];
    } else {
      this._listeners = {};
    }
  }
}

const DeviceEventEmitter = new NativeEventEmitter();

const TurboModuleRegistry = {
  get: jest.fn(name => (name === 'Pushy' ? mockPushy : null)),
  getEnforcing: jest.fn(name => {
    if (name === 'Pushy') {
      return mockPushy;
    }
    throw new Error(`TurboModule ${name} not found`);
  }),
};

module.exports = {
  Platform: {
    OS: 'harmony',
    Version: '5.0.0',
    select: obj =>
      obj.harmony ?? obj.default ?? obj.android ?? obj.ios ?? obj.web,
  },
  NativeModules: {
    Pushy: mockPushy,
  },
  NativeEventEmitter,
  DeviceEventEmitter,
  TurboModuleRegistry,
  Alert: {alert: jest.fn()},
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
  },
  Linking: {
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
    getInitialURL: jest.fn(() => Promise.resolve(null)),
    openURL: jest.fn(() => Promise.resolve()),
  },
  __mockPushy: mockPushy,
  __createPushyNativeModule: createPushyNativeModule,
};
