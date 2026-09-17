/**
 * Copyright (c) 2026 Huawei Technologies Co., Ltd.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

describe('index public exports', () => {
  it('exports the JS API surface used by Harmony apps', () => {
    const api = require('../../src/index');
    [
      'Cresc',
      'Pushy',
      'PushyModule',
      'UpdateModule',
      'UpdateError',
      'PushyProvider',
      'UpdateProvider',
      'usePushy',
      'useUpdate',
      'useUpdateProgress',
      'ProgressContext',
      'UpdateContext',
      'attachToCrashlytics',
      'attachToSentry',
      'attachUpdateMetadata',
      'getUpdateMetadata',
      'updateMetadataTags',
    ].forEach(name => {
      expect(api[name]).toBeDefined();
    });
    expect(api.UpdateModule).toBe(api.PushyModule);
    expect(api.Cresc.prototype).toBeInstanceOf(Object);
  });
});

describe('UpdateError', () => {
  const {
    UpdateError,
    asUpdateErrorCode,
    readErrorCode,
    toUpdateError,
  } = require('../../src/error');

  it('constructs with a stable machine-readable code', () => {
    const err = new UpdateError('download failed', 'DOWNLOAD_FAILED');
    expect(err.name).toBe('UpdateError');
    expect(err.message).toBe('download failed');
    expect(err.code).toBe('DOWNLOAD_FAILED');
  });

  it('asUpdateErrorCode keeps known codes and drops foreign ones', () => {
    expect(asUpdateErrorCode('PATCH_FAILED')).toBe('PATCH_FAILED');
    expect(asUpdateErrorCode('ERR_NETWORK')).toBeUndefined();
    expect(asUpdateErrorCode(404)).toBeUndefined();
  });

  it('readErrorCode prefers the code property over a [CODE] prefix', () => {
    const err = new Error('[HTTP_STATUS] ignored');
    err.code = 'DOWNLOAD_FAILED';
    expect(readErrorCode(err)).toEqual({
      code: 'DOWNLOAD_FAILED',
      message: 'ignored',
    });
  });

  it('readErrorCode parses a Harmony [CODE] message prefix', () => {
    expect(readErrorCode(new Error('[PATCH_FAILED] copiesCrc mismatch'))).toEqual(
      {
        code: 'PATCH_FAILED',
        message: 'copiesCrc mismatch',
      },
    );
    expect(readErrorCode('plain string')).toEqual({
      code: undefined,
      message: 'plain string',
    });
    expect(readErrorCode(null)).toEqual({code: undefined, message: ''});
  });

  it('toUpdateError preserves an Error identity and assigns a known code', () => {
    const original = new Error('boom');
    const wrapped = toUpdateError(original, 'CHECK_FAILED');
    expect(wrapped).toBe(original);
    expect(wrapped.code).toBe('CHECK_FAILED');
  });

  it('toUpdateError lifts a [CODE] prefix onto the code property', () => {
    const original = new Error('[RESET_FAILED] unlink');
    const wrapped = toUpdateError(original, 'CHECK_FAILED');
    expect(wrapped.code).toBe('RESET_FAILED');
    expect(wrapped.message).toBe('unlink');
  });

  it('toUpdateError wraps non-Error values', () => {
    const wrapped = toUpdateError('disk', 'FILE_OPERATION_FAILED');
    expect(wrapped).toBeInstanceOf(UpdateError);
    expect(wrapped.code).toBe('FILE_OPERATION_FAILED');
    expect(wrapped.message).toBe('disk');
  });
});

describe('updateFlowCore', () => {
  const {
    murmurhash3_32_gc,
    isInRollout,
    joinUrls,
    dedupeEndpoints,
    orderEndpointCandidates,
    buildCheckRequestBody,
    buildCheckFingerprint,
    isMirrorRetryableCode,
    isValidCheckResult,
    resolveCheckResult,
    shouldActivateAfterDownload,
    decideDownload,
  } = require('../../src/updateFlowCore');

  it('murmurhash3_32_gc is deterministic and in uint32 range', () => {
    const a = murmurhash3_32_gc('client-uuid');
    const b = murmurhash3_32_gc('client-uuid');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(murmurhash3_32_gc('x')).not.toBe(murmurhash3_32_gc('y'));
  });

  it('isInRollout returns false for 0 and true for 100', () => {
    expect(isInRollout(0, 'any')).toBe(false);
    expect(isInRollout(100, 'any')).toBe(true);
  });

  it('joinUrls prefixes bare hosts and keeps explicit http(s) URLs', () => {
    expect(joinUrls(['cdn.example.com/p/', 'https://other/p'], 'a.ppk')).toEqual(
      ['https://cdn.example.com/p/a.ppk', 'https://other/p/a.ppk'],
    );
    expect(joinUrls(['https://cdn.example.com/p'])).toBeUndefined();
  });

  it('dedupeEndpoints drops empty values and duplicates', () => {
    expect(
      dedupeEndpoints(['a', null, 'b', 'a', undefined, '']),
    ).toEqual(['a', 'b']);
  });

  it('orderEndpointCandidates moves the sampled pick to the front', () => {
    expect(orderEndpointCandidates(['a'])).toEqual(['a']);
    expect(orderEndpointCandidates(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
    expect(orderEndpointCandidates(['a', 'b', 'c'], 0.99)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(orderEndpointCandidates(['a', 'b'], Number.NaN)).toEqual(['a', 'b']);
  });

  it('buildCheckRequestBody keeps identity fields and omits empty optionals', () => {
    const body = buildCheckRequestBody({
      packageVersion: '1.0.0',
      currentVersion: 'h1',
      buildTime: 't1',
      cInfo: {rn: '0.72.5'},
      extra: {channel: 'beta', packageVersion: 'ignored', skip: undefined},
    });
    expect(body.packageVersion).toBe('1.0.0');
    expect(body.hash).toBe('h1');
    expect(body.buildTime).toBe('t1');
    expect(body.channel).toBe('beta');
    expect(body.diffV).toBeUndefined();
    expect(body.bundleHash).toBeUndefined();
    expect(body.extra).toEqual({channel: 'beta', packageVersion: 'ignored'});
  });

  it('buildCheckRequestBody reports diffV / bundleHash and drops buildTime in dev', () => {
    const body = buildCheckRequestBody({
      packageVersion: '1.0.0',
      buildTime: 't1',
      cInfo: {},
      supportedDiffVersion: 2,
      bundleHash: 'sha',
      isDev: true,
    });
    expect(body.diffV).toBe(2);
    expect(body.bundleHash).toBe('sha');
    expect(body.buildTime).toBeUndefined();
  });

  it('buildCheckFingerprint serializes the identity tuple', () => {
    expect(
      buildCheckFingerprint({
        appKey: 'k',
        endpoints: ['e1'],
        queryUrls: [],
        uuid: 'u',
        body: '{}',
      }),
    ).toBe(JSON.stringify(['k', ['e1'], [], 'u', '{}']));
    expect(buildCheckFingerprint({body: '{}'})).toBe(
      JSON.stringify(['', [], [], '', '{}']),
    );
  });

  it('isMirrorRetryableCode is false only for PATCH_FAILED', () => {
    expect(isMirrorRetryableCode('DOWNLOAD_FAILED')).toBe(true);
    expect(isMirrorRetryableCode(undefined)).toBe(true);
    expect(isMirrorRetryableCode('PATCH_FAILED')).toBe(false);
  });

  it('isValidCheckResult accepts a verdict object and rejects others', () => {
    expect(isValidCheckResult({upToDate: true})).toBe(true);
    expect(isValidCheckResult({update: false})).toBe(true);
    expect(isValidCheckResult({expired: true})).toBe(true);
    expect(isValidCheckResult({paused: 'app'})).toBe(true);
    expect(isValidCheckResult({error: 'no'})).toBe(false);
    expect(isValidCheckResult([])).toBe(false);
    expect(isValidCheckResult(null)).toBe(false);
    expect(isValidCheckResult('html')).toBe(false);
  });

  it('resolveCheckResult returns upToDate when the offered hash is current', () => {
    expect(
      resolveCheckResult(
        {update: true, hash: 'cur'},
        {packageVersion: '1.0.0', currentVersion: 'cur', uuid: 'u'},
      ),
    ).toEqual({upToDate: true});
  });

  it('resolveCheckResult applies gray-release rollout and ignores misses', () => {
    const expVersion = {
      name: 'exp',
      hash: 'exp-hash',
      config: {rollout: {'1.0.0': 100}},
    };
    const inRollout = resolveCheckResult(
      {update: true, hash: 'stable', paths: ['cdn'], expVersion},
      {packageVersion: '1.0.0', currentVersion: 'old', uuid: 'u'},
    );
    expect(inRollout.update).toBe(true);
    expect(inRollout.hash).toBe('exp-hash');
    expect(inRollout.paths).toEqual(['cdn']);

    const alreadyOnExp = resolveCheckResult(
      {update: true, hash: 'stable', expVersion},
      {packageVersion: '1.0.0', currentVersion: 'exp-hash', uuid: 'u'},
    );
    expect(alreadyOnExp).toEqual({upToDate: true});

    const missed = resolveCheckResult(
      {
        update: true,
        hash: 'stable',
        expVersion: {
          name: 'exp',
          hash: 'exp-hash',
          config: {rollout: {'1.0.0': 0}},
        },
      },
      {packageVersion: '1.0.0', currentVersion: 'old', uuid: 'u'},
    );
    expect(missed.hash).toBe('stable');
  });

  it('shouldActivateAfterDownload honors setNeedUpdate and forceBoot', () => {
    expect(shouldActivateAfterDownload({}, 'setNeedUpdate')).toBe(true);
    expect(shouldActivateAfterDownload({config: {forceBoot: true}})).toBe(true);
    expect(shouldActivateAfterDownload({}, 'alwaysAlert')).toBe(false);
  });

  it('decideDownload covers none and download branches', () => {
    expect(decideDownload({}, {})).toEqual({action: 'none', reason: 'noUpdate'});
    expect(decideDownload({update: true, hash: 'cur'}, {currentVersion: 'cur'})).toEqual(
      {action: 'none', reason: 'alreadyCurrent'},
    );
    expect(
      decideDownload(
        {update: true, hash: 'bad'},
        {rolledBackVersion: 'bad'},
      ),
    ).toEqual({action: 'none', reason: 'rolledBack'});
    expect(
      decideDownload({update: true, hash: 'h2', paths: ['cdn']}, {}),
    ).toEqual({action: 'none', reason: 'noArtifact'});

    const plan = decideDownload(
      {
        update: true,
        hash: 'h2',
        paths: ['cdn.example/p'],
        diff: 'a.diff',
        pdiff: 'a.pdiff',
        full: 'a.ppk',
      },
      {currentVersion: 'h1'},
    );
    expect(plan.action).toBe('download');
    expect(plan.hash).toBe('h2');
    expect(plan.attempts.map(item => item.type)).toEqual([
      'diff',
      'pdiff',
      'full',
    ]);
    expect(plan.devNoop).toBe(false);

    const dev = decideDownload(
      {update: true, hash: 'h2', paths: ['cdn'], full: 'a.ppk'},
      {},
      true,
    );
    expect(dev.attempts.map(item => item.type)).toEqual(['full']);

    const devNoop = decideDownload(
      {update: true, hash: 'h2', paths: ['cdn']},
      {},
      true,
    );
    expect(devNoop.action).toBe('download');
    expect(devNoop.devNoop).toBe(true);
  });
});

describe('utils', () => {
  const utils = require('../../src/utils');

  it('computeProgress clamps to 0-100 and treats missing total as 0', () => {
    expect(utils.computeProgress(50, 100)).toBe(50);
    expect(utils.computeProgress(200, 100)).toBe(100);
    expect(utils.computeProgress(-10, 100)).toBe(0);
    expect(utils.computeProgress(10, 0)).toBe(0);
  });

  it('isProtocolDowngrade detects https to http redirects', () => {
    expect(
      utils.isProtocolDowngrade('https://a.example/x', 'http://a.example/x'),
    ).toBe(true);
    expect(
      utils.isProtocolDowngrade('https://a.example/x', 'https://b.example/x'),
    ).toBe(false);
    expect(utils.isProtocolDowngrade('https://a.example/x', null)).toBe(false);
  });

  it('parseQueryParams decodes values and ignores fragments', () => {
    expect(utils.parseQueryParams('pushy://test')).toEqual({});
    expect(
      utils.parseQueryParams(
        'pushy://test?type=debug&data=a%2Bb&empty&flag&x=+1#frag',
      ),
    ).toEqual({
      type: 'debug',
      data: 'a+b',
      empty: '',
      flag: '',
      x: ' 1',
    });
  });

  it('promiseAny resolves the first success and rejects when all fail', async () => {
    await expect(
      utils.promiseAny([Promise.reject('a'), Promise.resolve('ok')]),
    ).resolves.toBe('ok');
    await expect(utils.promiseAny([])).rejects.toThrow();
    await expect(
      utils.promiseAny([Promise.reject('a'), Promise.reject('b')]),
    ).rejects.toThrow();
  });

  it('emptyModule returns a noop for any property', () => {
    expect(typeof utils.emptyModule.anyMethod).toBe('function');
    expect(utils.emptyModule.anyMethod()).toBeUndefined();
    expect(utils.noop()).toBeUndefined();
  });

  it('assertWeb returns true on Harmony', () => {
    expect(utils.assertWeb()).toBe(true);
    expect(utils.isWeb).toBe(false);
  });

  it('testUrls returns null for an empty list and the winner on success', async () => {
    await expect(utils.testUrls()).resolves.toBeNull();
    await expect(utils.testUrls([])).resolves.toBeNull();
    await expect(
      utils.testUrls(['https://cdn.example/a.ppk']),
    ).resolves.toBe('https://cdn.example/a.ppk');
  });

  it('testUrls falls back to the first URL when every ping fails', async () => {
    global.fetch.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    await expect(utils.testUrls(['https://dead.example/x'])).resolves.toBe(
      'https://dead.example/x',
    );
  });

  it('enhancedFetch rejects an https to http redirect', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      url: 'http://insecure.example/x',
    });
    await expect(
      utils.enhancedFetch('https://secure.example/x', {method: 'GET'}),
    ).rejects.toThrow();
  });

  it('fetchWithTimeout maps an aborted controller to a timeout error', async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementationOnce(
      (_url, {signal}) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = utils.fetchWithTimeout(
      'https://slow.example',
      {method: 'HEAD'},
      10,
    );
    jest.advanceTimersByTime(15);
    await expect(pending).rejects.toThrow();
    jest.useRealTimers();
  });

  it('log / info honor debugLogging while warn / error always print', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    utils.setDebugLogging(true);
    utils.log('l');
    utils.info('i');
    utils.warn('w');
    utils.error('e');
    expect(log).toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    log.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('i18n', () => {
  const i18n = require('../../src/i18n').default;

  afterEach(() => {
    i18n.setLocale('en');
  });

  it('switches locale and interpolates placeholders', () => {
    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
    expect(i18n.t('download_progress', {progress: 50})).toContain('50');
    i18n.setLocale('zh');
    expect(i18n.getLocale()).toBe('zh');
    expect(i18n.t('error_appkey_required')).toBeTruthy();
  });

  it('falls back to the key when both locales miss it', () => {
    expect(i18n.t('not_a_real_key')).toBe('not_a_real_key');
  });

  it('keeps the placeholder when the value is missing', () => {
    expect(i18n.t('download_progress', {})).toContain('{{progress}}');
  });

  it('addTranslations merges keys into a locale', () => {
    i18n.addTranslations('en', {custom_key: 'hello'});
    expect(i18n.t('custom_key')).toBe('hello');
  });
});

describe('endpoint fallback', () => {
  const {
    executeEndpointFallback,
    selectFastestSuccessfulEndpoint,
    DEFAULT_HEDGE_DELAY_MS,
  } = require('../../src/endpoint');
  const {UpdateError} = require('../../src/error');

  it('throws NO_ENDPOINTS when the configured list is empty', async () => {
    await expect(
      executeEndpointFallback({
        configuredEndpoints: [],
        tryEndpoint: async () => ({}),
      }),
    ).rejects.toBeInstanceOf(UpdateError);
  });

  it('returns the first endpoint when it succeeds', async () => {
    const result = await executeEndpointFallback({
      configuredEndpoints: ['https://a.example', 'https://b.example'],
      tryEndpoint: async endpoint => ({ok: endpoint}),
      random: () => 0,
    });
    expect(result.endpoint).toBe('https://a.example');
    expect(result.value).toEqual({ok: 'https://a.example'});
  });

  it('falls back to a remote endpoint after the first failure', async () => {
    const result = await executeEndpointFallback({
      configuredEndpoints: ['https://dead.example'],
      getRemoteEndpoints: async () => ['https://live.example'],
      tryEndpoint: async endpoint => {
        if (endpoint.includes('dead')) {
          throw new Error('down');
        }
        return {ok: true};
      },
      onFirstFailure: jest.fn(),
      hedgeDelayMs: 0,
    });
    expect(result.endpoint).toBe('https://live.example');
  });

  it('selectFastestSuccessfulEndpoint resolves empty when there are no candidates', async () => {
    await expect(
      selectFastestSuccessfulEndpoint([], async () => 1),
    ).resolves.toEqual({failures: []});
  });

  it('selectFastestSuccessfulEndpoint records failures when every candidate fails', async () => {
    const {success, failures} = await selectFastestSuccessfulEndpoint(
      ['https://a', 'https://b'],
      async () => {
        throw new Error('no');
      },
      Date.now,
      0,
    );
    expect(success).toBeUndefined();
    expect(failures).toHaveLength(2);
  });

  it('exposes the default hedge delay', () => {
    expect(DEFAULT_HEDGE_DELAY_MS).toBe(250);
  });
});

describe('metadata', () => {
  const {
    getUpdateMetadata,
    updateMetadataTags,
    attachUpdateMetadata,
    attachToSentry,
    attachToCrashlytics,
  } = require('../../src/metadata');

  it('getUpdateMetadata returns the running-bundle identity', () => {
    const metadata = getUpdateMetadata();
    expect(metadata.packageVersion).toBe('1.0.0');
    expect(metadata.currentVersion).toBe('');
    expect(metadata.isFirstTime).toBe(false);
    expect(metadata.isRolledBack).toBe(false);
    expect(metadata.uuid).toBe('test-uuid-001');
    expect(metadata.rescueSource).toBeNull();
  });

  it('updateMetadataTags flattens values with a prefix', () => {
    const tags = updateMetadataTags(
      {currentVersion: 'h1', rescueSource: null},
      'pushy.',
    );
    expect(tags['pushy.currentVersion']).toBe('h1');
    expect(tags['pushy.rescueSource']).toBe('');
  });

  it('attachUpdateMetadata writes tags through setTag and setContext', () => {
    const reporter = {
      setTag: jest.fn(),
      setContext: jest.fn(),
    };
    const metadata = attachUpdateMetadata(reporter);
    expect(reporter.setTag).toHaveBeenCalled();
    expect(reporter.setContext).toHaveBeenCalledWith(
      'pushy',
      expect.objectContaining({packageVersion: metadata.packageVersion}),
    );
  });

  it('attachUpdateMetadata falls back to setAttributes / setAttribute', () => {
    const withAttrs = {setAttributes: jest.fn()};
    attachUpdateMetadata(withAttrs, {contextName: null});
    expect(withAttrs.setAttributes).toHaveBeenCalled();

    const withAttr = {setAttribute: jest.fn()};
    attachUpdateMetadata(withAttr, {contextName: null});
    expect(withAttr.setAttribute).toHaveBeenCalled();
  });

  it('attachUpdateMetadata swallows reporter failures', () => {
    expect(() =>
      attachUpdateMetadata({
        setTag: () => {
          throw new Error('reporter down');
        },
      }),
    ).not.toThrow();
  });

  it('attachToSentry / attachToCrashlytics are thin wrappers', () => {
    const sentry = {setTag: jest.fn(), setContext: jest.fn()};
    attachToSentry(sentry);
    expect(sentry.setContext).toHaveBeenCalledWith('pushy', expect.any(Object));

    const crash = {setAttributes: jest.fn()};
    attachToCrashlytics(crash);
    expect(crash.setAttributes).toHaveBeenCalled();
  });
});

describe('Pushy / Cresc client', () => {
  const loadClient = () => {
    jest.resetModules();
    return require('../../src/client');
  };

  it('throws APPKEY_REQUIRED when appKey is missing', () => {
    const {Pushy, UpdateError} = loadClient();
    expect(() => new Pushy({})).toThrow(UpdateError);
    try {
      new Pushy({});
    } catch (e) {
      expect(e.code).toBe('APPKEY_REQUIRED');
    }
  });

  it('constructs a Pushy client and applies options', () => {
    const {Pushy} = loadClient();
    const client = new Pushy({appKey: 'app-key-1', debug: true});
    expect(client.clientType).toBe('Pushy');
    expect(client.options.appKey).toBe('app-key-1');
    expect(client.options.server.main.length).toBeGreaterThan(0);
    client.setOptions({updateStrategy: 'silentAndNow'});
    expect(client.options.updateStrategy).toBe('silentAndNow');
    expect(client.optionsVersion).toBeGreaterThan(0);
  });

  it('reuses the same client for an identical re-creation', () => {
    const {Pushy} = loadClient();
    const first = new Pushy({appKey: 'same-key'});
    const second = new Pushy({appKey: 'same-key', debug: true});
    expect(second).toBe(first);
    expect(first.options.debug).toBe(true);
  });

  it('throws SINGLETON_VIOLATION for a second client with another appKey', () => {
    const {Pushy} = loadClient();
    new Pushy({appKey: 'one'});
    try {
      new Pushy({appKey: 'two'});
      throw new Error('expected SINGLETON_VIOLATION');
    } catch (e) {
      expect(e.code).toBe('SINGLETON_VIOLATION');
    }
  });

  it('Cresc uses the international server preset', () => {
    const {Cresc} = loadClient();
    const client = new Cresc({appKey: 'cresc-key'});
    expect(client.clientType).toBe('Cresc');
    expect(client.options.server.main.join(',')).toContain('cresc');
  });

  it('onOptionsChange notifies listeners and unsubscribe stops them', () => {
    const {Pushy} = loadClient();
    const client = new Pushy({appKey: 'opt-key'});
    const listener = jest.fn();
    const off = client.onOptionsChange(listener);
    client.setOptions({debug: true});
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    client.setOptions({debug: false});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('markSuccess is a no-op in __DEV__', async () => {
    const {Pushy} = loadClient();
    const client = new Pushy({appKey: 'mark-key'});
    await expect(client.markSuccess()).resolves.toBeUndefined();
  });

  it('switchVersion returns false when nothing has been downloaded', async () => {
    const {Pushy} = loadClient();
    const client = new Pushy({appKey: 'switch-key', debug: true});
    await expect(client.switchVersion('missing')).resolves.toBe(false);
  });
});
