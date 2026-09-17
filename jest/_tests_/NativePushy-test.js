/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
  TurboModuleRegistry,
  NativeModules,
  NativeEventEmitter,
} = require('react-native');

const NATIVE_METHODS = [
  'getConstants',
  'setLocalHashInfo',
  'getLocalHashInfo',
  'setUuid',
  'syncNativeConfig',
  'getNativeCheckCache',
  'markJsCheckCompleted',
  'reloadUpdate',
  'restartApp',
  'setNeedUpdate',
  'markSuccess',
  'getBundleHash',
  'resetToPackagedBundle',
  'downloadPatchFromPpk',
  'downloadPatchFromPackage',
  'downloadFullUpdate',
  'downloadAndInstallApk',
  'addListener',
  'removeListeners',
];

const CONSTANT_KEYS = [
  'downloadRootDir',
  'packageVersion',
  'currentVersion',
  'isFirstTime',
  'rolledBackVersion',
  'buildTime',
  'uuid',
  'isUsingBundleUrl',
  'currentVersionInfo',
  'supportedDiffVersion',
];

describe('NativePushy TurboModule spec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the Pushy module from TurboModuleRegistry.get', () => {
    const spec = TurboModuleRegistry.get('Pushy');
    expect(spec).toBe(global.__mockPushy);
  });

  it('returns null for an unknown TurboModule name', () => {
    expect(TurboModuleRegistry.get('UnknownModule')).toBeNull();
  });

  it('exposes every Spec method required by NativePushy.ts', () => {
    const spec = TurboModuleRegistry.get('Pushy');
    NATIVE_METHODS.forEach(methodName => {
      expect(typeof spec[methodName]).toBe('function');
    });
  });

  it('getConstants returns the native identity fields', () => {
    const constants = TurboModuleRegistry.get('Pushy').getConstants();
    CONSTANT_KEYS.forEach(key => {
      expect(constants).toHaveProperty(key);
    });
    expect(constants.downloadRootDir).toContain('_update');
    expect(typeof constants.supportedDiffVersion).toBe('number');
    expect(typeof constants.isFirstTime).toBe('boolean');
  });
});

describe('NativePushy method contracts', () => {
  let spec;

  beforeEach(() => {
    jest.clearAllMocks();
    spec = NativeModules.Pushy;
  });

  it('setLocalHashInfo persists JSON and getLocalHashInfo reads it back', async () => {
    const info = JSON.stringify({name: '1.0.1', description: 'fix'});
    await spec.setLocalHashInfo('abc123', info);
    await expect(spec.getLocalHashInfo('abc123')).resolves.toBe(info);
  });

  it('getLocalHashInfo returns empty string when the hash has no record', async () => {
    await expect(spec.getLocalHashInfo('missing-hash')).resolves.toBe('');
  });

  it('setUuid stores the client id', async () => {
    await spec.setUuid('uuid-new');
    expect(spec.setUuid).toHaveBeenCalledWith('uuid-new');
    expect(spec.__kvStore.uuid).toBe('uuid-new');
  });

  it('syncNativeConfig accepts valid JSON and rejects invalid JSON', async () => {
    await expect(
      spec.syncNativeConfig(JSON.stringify({appKey: 'k'})),
    ).resolves.toBeUndefined();
    await expect(spec.syncNativeConfig('{bad')).rejects.toThrow();
  });

  it('getNativeCheckCache resolves to empty string when absent', async () => {
    await expect(spec.getNativeCheckCache()).resolves.toBe('');
  });

  it('markJsCheckCompleted rejects an empty config', async () => {
    await expect(spec.markJsCheckCompleted('')).rejects.toThrow(
      'INVALID_OPTIONS',
    );
    await spec.markJsCheckCompleted('{"appKey":"k"}');
    expect(spec.__kvStore.jsCheckCompleted).toBe('{"appKey":"k"}');
  });

  it('reloadUpdate / setNeedUpdate / restartApp / markSuccess resolve', async () => {
    await expect(spec.reloadUpdate({hash: 'h1'})).resolves.toBeUndefined();
    await expect(spec.setNeedUpdate({hash: 'h1'})).resolves.toBeUndefined();
    await expect(spec.restartApp()).resolves.toBeUndefined();
    await expect(spec.markSuccess()).resolves.toBeUndefined();
  });

  it('getBundleHash resolves to a string and never rejects', async () => {
    await expect(spec.getBundleHash()).resolves.toBe('bundle-hash-mock');
  });

  it('resetToPackagedBundle resolves', async () => {
    await expect(spec.resetToPackagedBundle()).resolves.toBeUndefined();
  });

  it('download methods resolve for ppk / package / full strategies', async () => {
    await expect(
      spec.downloadPatchFromPpk({
        updateUrl: 'https://cdn.example/a.ppk',
        hash: 'h2',
        originHash: 'h1',
      }),
    ).resolves.toBeUndefined();
    await expect(
      spec.downloadPatchFromPackage({
        updateUrl: 'https://cdn.example/a.patch',
        hash: 'h2',
      }),
    ).resolves.toBeUndefined();
    await expect(
      spec.downloadFullUpdate({
        updateUrl: 'https://cdn.example/a.ppk',
        hash: 'h2',
      }),
    ).resolves.toBeUndefined();
  });

  it('downloadAndInstallApk rejects with UNSUPPORTED_PLATFORM on Harmony', async () => {
    await expect(
      spec.downloadAndInstallApk({
        url: 'https://cdn.example/app.apk',
        target: '/tmp/app.apk',
        hash: 'h2',
      }),
    ).rejects.toThrow('UNSUPPORTED_PLATFORM');
  });

  it('addListener and removeListeners are callable no-ops', () => {
    expect(() => spec.addListener('RCTPushyDownloadProgress')).not.toThrow();
    expect(() => spec.removeListeners(1)).not.toThrow();
  });
});

describe('core native module wiring', () => {
  it('PushyModule and UpdateModule point at the mocked native module', () => {
    const {PushyModule, UpdateModule} = require('../../src/core');
    expect(PushyModule).toBeTruthy();
    expect(UpdateModule).toBe(PushyModule);
  });

  it('exposes native constants from the bridge object', () => {
    const core = require('../../src/core');
    expect(core.packageVersion).toBe('1.0.0');
    expect(core.currentVersion).toBe('');
    expect(core.isFirstTime).toBe(false);
    expect(core.isRolledBack).toBe(false);
    expect(core.supportedDiffVersion).toBe(2);
    expect(core.downloadRootDir).toContain('_update');
    expect(core.cInfo.rn).toBe('0.72.5');
    expect(core.cInfo.os).toContain('harmony');
    expect(core.cInfo.uuid).toBe('test-uuid-001');
  });

  it('setLocalHashInfo stringifies info before calling native', async () => {
    const {setLocalHashInfo} = require('../../src/core');
    await setLocalHashInfo('hash-a', {name: 'v2'});
    expect(NativeModules.Pushy.setLocalHashInfo).toHaveBeenCalledWith(
      'hash-a',
      JSON.stringify({name: 'v2'}),
    );
  });

  it('getCurrentVersionInfo returns empty object when currentVersion is empty', async () => {
    const {getCurrentVersionInfo} = require('../../src/core');
    await expect(getCurrentVersionInfo()).resolves.toEqual({});
  });

  it('getBundleHash is a sync reader of the prefetched native hash', async () => {
    const {getBundleHash} = require('../../src/core');
    await Promise.resolve();
    expect(typeof getBundleHash()).toBe('string');
  });

  it('creates a NativeEventEmitter bound to the Pushy module', () => {
    const {pushyNativeEventEmitter} = require('../../src/core');
    expect(pushyNativeEventEmitter).toBeInstanceOf(NativeEventEmitter);
  });
});

describe('Harmony ErrorCodes helpers', () => {
  const {
    createUpdateError,
    toUpdateError,
    getErrorMessage,
    parseErrorCodePrefix,
    ERROR_INVALID_OPTIONS,
    ERROR_PATCH_FAILED,
    UpdateError,
  } = require('../../harmony/update/src/main/ets/ErrorCodes');

  it('createUpdateError prefixes the message with [CODE]', () => {
    const err = createUpdateError(ERROR_INVALID_OPTIONS, 'empty hash');
    expect(err).toBeInstanceOf(UpdateError);
    expect(err.code).toBe(ERROR_INVALID_OPTIONS);
    expect(err.message).toBe('[INVALID_OPTIONS] empty hash');
  });

  it('toUpdateError keeps an existing UpdateError identity', () => {
    const original = createUpdateError(ERROR_PATCH_FAILED, 'crc');
    expect(toUpdateError(original, ERROR_INVALID_OPTIONS)).toBe(original);
  });

  it('toUpdateError wraps a plain Error with the default code', () => {
    const wrapped = toUpdateError(new Error('disk full'), 'FILE_OPERATION_FAILED');
    expect(wrapped.code).toBe('FILE_OPERATION_FAILED');
    expect(wrapped.message).toBe('[FILE_OPERATION_FAILED] disk full');
  });

  it('getErrorMessage reads Error message and stringifies others', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage({message: 12})).toBe('12');
    expect(getErrorMessage('plain')).toBe('plain');
  });

  it('parseErrorCodePrefix extracts a stable code or returns empty', () => {
    expect(parseErrorCodePrefix('[PATCH_FAILED] copiesCrc mismatch')).toBe(
      'PATCH_FAILED',
    );
    expect(parseErrorCodePrefix('no prefix')).toBe('');
    expect(parseErrorCodePrefix('[bad] x')).toBe('');
    expect(parseErrorCodePrefix('[] ')).toBe('');
  });
});
