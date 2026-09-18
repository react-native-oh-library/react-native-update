/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

global.nativeModuleProxy = global.nativeModuleProxy || {};
global.__DEV__ = true;

if (typeof global.nativeFabricUIManager === 'undefined') {
  const cache = {};
  global.nativeFabricUIManager = new Proxy(cache, {
    get: function (target, property) {
      if (!(property in target)) {
        target[property] = jest.fn();
      }
      return target[property];
    },
  });
}

if (typeof global.queueMicrotask === 'undefined') {
  global.queueMicrotask = function (callback) {
    return Promise.resolve().then(callback);
  };
}

const rn = require('./rn-mock');
global.__mockPushy = rn.__mockPushy;
global.__createPushyNativeModule = rn.__createPushyNativeModule;

global.fetch = jest.fn(async url => ({
  status: 200,
  statusText: 'OK',
  url,
  ok: true,
  json: async () => ({}),
  text: async () => '',
}));
