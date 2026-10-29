/**
 * react-native-update（Pushy 热更新）OpenHarmony Example 测试页
 *
 * 两个部分：
 * 1.「标准接入」：PushyProvider + useUpdate 对接官方热更新服务（update.reactnative.cn）。
 *    在“测试输入”里填入真实 appKey 后（运行时经 setOptions 生效，无需改代码），
 *    可完整走标准链路：检查更新 →（弹窗确认/静默）下载 → 立即/下次启动切换
 *    → markSuccess → 回退内置包/重启。
 * 2.「TurboModule 方法」：覆盖 03-coding-library implemented_methods 的全部 19 个方法，
 *    每个方法一个 Run 按钮（testID: test-{method}-btn），结果写入 Result:/Error: 区块；
 *    下载进度事件走鸿蒙 DeviceEventEmitter（RCTPushyDownloadProgress）。
 *
 * DEV（metro）构建注意：
 * - client.debug 已设为 true，否则 checkUpdate/switchVersion 会被 assertDebug 跳过；
 * - markSuccess 在 DEV 下为 no-op；增量 diff/pdiff 仅对 release 产物存在，DEV 只走 full；
 * - 完整回归（增量下载 + 自动 markSuccess）请用 release 包验证。
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Pushy,
  PushyModule,
  PushyProvider,
  useUpdate,
  useUpdateProgress,
} from '@react-native-ohos/react-native-update';
import type {
  CheckResult,
  ClientOptions,
} from '@react-native-ohos/react-native-update';

const PAGE_TITLE = 'React Native Update 热更新测试 · OTA-A';

// 默认 appKey：pushy.reactnative.cn 控制台创建的应用。也可在页面“测试输入”里
// 运行时修改（经 setOptions 生效，无需重启）。
const DEFAULT_APPKEY = '8sqsNreEOSy1yQL5REkf8CUx';
// fast refresh 后本模块重新执行，客户端单例要求同 appKey 重建；把最后一次使用的
// appKey 挂在 globalThis 上，避免输入框内容触发热刷新时抛 SINGLETON_VIOLATION。
const APPKEY_GLOBAL_KEY = '__pushy_demo_appkey__';
const globalStore = globalThis as unknown as Record<string, unknown>;
const initialAppKey =
  (globalStore[APPKEY_GLOBAL_KEY] as string) || DEFAULT_APPKEY;

function createClient(): Pushy {
  return new Pushy({
    appKey: initialAppKey,
    // DEV 构建下 checkUpdate/switchVersion/markSuccess 相关流程会被 assertDebug
    // 跳过，debug 必须打开
    debug: false,
    // 标准接入仅提供手动检查，通过“检查更新”按钮触发。
    checkStrategy: null,
    // 弹窗流（发现新版本 → 确认 → 下载 → 立即/下次），面板可切静默策略
    updateStrategy: 'alwaysAlert',
    logger: event => {
      console.log(`[pushy:${event.type}]`, event.data);
    },
  });
}

const pushyClient = createClient();
globalStore[APPKEY_GLOBAL_KEY] = initialAppKey;

const UPDATE_STRATEGIES: {
  value: NonNullable<ClientOptions['updateStrategy']>;
  label: string;
}[] = [
  { value: 'alwaysAlert', label: '弹窗提示' }
];

const CHECK_STRATEGIES: {
  value: Exclude<ClientOptions['checkStrategy'], undefined>;
  label: string;
}[] = [
  { value: null, label: '手动' },
];

interface DownloadProgressEvent {
  received: number;
  total: number;
  hash: string;
}

interface MethodCase {
  slug: string;
  label: string;
  testID: string;
  note?: string;
  inputs?: {
    key: string;
    label: string;
    value: string;
    onChangeText: (value: string) => void;
  }[];
  run: () => unknown;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    const code = (e as {code?: string}).code;
    return code ? `[${code}] ${e.message}` : e.message;
  }
  return String(e);
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value === '' ? "(empty string)" : value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeUpdateInfo(info: CheckResult | undefined): string {
  if (!info) {
    return '尚未检查';
  }
  if (info.upToDate) {
    return '已是最新版本（upToDate）';
  }
  if (info.expired) {
    return `安装包已过期（expired），downloadUrl: ${info.downloadUrl ?? ''}`;
  }
  if (info.update) {
    return `发现新版本：${info.name ?? ''}（hash: ${info.hash ?? ''}）${
      info.description ? `\n${info.description}` : ''
    }`;
  }
  return formatValue(info);
}

/**
 * 标准接入面板：必须在 PushyProvider 内部使用（useUpdate 依赖 UpdateContext）。
 */
function StandardFlowSection() {
  const {
    checkUpdate,
    downloadUpdate,
    restartApp,
    resetToPackagedBundle,
    dismissError,
    updateInfo,
    lastError,
    packageVersion,
    currentHash,
    currentVersionInfo,
  } = useUpdate();
  const progress = useUpdateProgress();

  const [actionLog, setActionLog] = useState<string[]>([]);
  const [updateStrategy, setUpdateStrategy] =
    useState<NonNullable<ClientOptions['updateStrategy']>>(
      pushyClient.options.updateStrategy ?? 'alwaysAlert',
    );
  const [checkStrategy, setCheckStrategy] = useState<
    Exclude<ClientOptions['checkStrategy'], undefined>
  >(pushyClient.options.checkStrategy ?? null);

  const record = useCallback((name: string, promise: Promise<unknown>) => {
    promise
      .then(value =>
        setActionLog(log =>
          [`${name} → ${formatValue(value)}`, ...log].slice(0, 6),
        ),
      )
      .catch(e =>
        setActionLog(log =>
          [`${name} → Error: ${errMsg(e)}`, ...log].slice(0, 6),
        ),
      );
  }, []);

  const applyUpdateStrategy = (
    value: NonNullable<ClientOptions['updateStrategy']>,
  ) => {
    pushyClient.setOptions({ updateStrategy: value });
    setUpdateStrategy(value);
  };

  const applyCheckStrategy = (
    value: Exclude<ClientOptions['checkStrategy'], undefined>,
  ) => {
    pushyClient.setOptions({ checkStrategy: value });
    setCheckStrategy(value);
  };

  const renderPicker = <T extends string | null>(
    items: { value: T; label: string }[],
    current: T | undefined,
    onPick: (value: T) => void,
    testPrefix: string,
  ) => (
    <View style={styles.pickerRow} testID={`${testPrefix}-row`}>
      {items.map(item => {
        const active = item.value === current;
        return (
          <TouchableOpacity
            key={String(item.value)}
            testID={`${testPrefix}-${String(item.value)}`}
            accessibilityLabel={`${testPrefix}-${String(item.value)}`}
            style={[styles.pickerButton, active && styles.pickerButtonActive]}
            onPress={() => onPick(item.value)}>
            <Text
              style={[
                styles.pickerButtonText,
                active && styles.pickerButtonTextActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>标准接入（PushyProvider + useUpdate）</Text>

      <Text style={styles.constantText}>
        packageVersion: {packageVersion || '(empty)'}
      </Text>
      <Text style={styles.constantText}>
        当前运行 hash（currentVersion）: {currentHash || '(内置包)'}
      </Text>
      <Text style={styles.constantText}>
        版本信息: {formatValue(currentVersionInfo)}
      </Text>

      <Text style={styles.inputLabel}>检查更新策略（checkStrategy）</Text>
      {renderPicker(
        CHECK_STRATEGIES,
        checkStrategy,
        applyCheckStrategy,
        'picker-checkStrategy',
      )}

      <Text style={styles.inputLabel}>更新策略（updateStrategy）</Text>
      {renderPicker(
        UPDATE_STRATEGIES,
        updateStrategy,
        applyUpdateStrategy,
        'picker-updateStrategy',
      )}

      <Text style={styles.inputLabel}>检查结果</Text>
      <View testID="standard-update-info" accessibilityLabel="standard-update-info">
        <Text style={styles.statusText}>{summarizeUpdateInfo(updateInfo)}</Text>
      </View>

      {progress ? (
        <Text style={styles.constantText} testID="standard-progress">
          下载进度：{progress.received}/{progress.total}
          {progress.progress !== undefined
            ? `（${progress.progress}%）`
            : ''}
        </Text>
      ) : null}

      {lastError ? (
        <View style={styles.errorBanner} testID="standard-last-error">
          <Text style={styles.errorText}>lastError: {errMsg(lastError)}</Text>
          <TouchableOpacity
            testID="standard-dismiss-error-btn"
            accessibilityLabel="standard-dismiss-error-btn"
            onPress={dismissError}>
            <Text style={styles.pickerButtonTextActive}>关闭</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity
          testID="standard-check-btn"
          accessibilityLabel="standard-check-btn"
          style={styles.button}
          onPress={() => record('checkUpdate', checkUpdate())}>
          <Text style={styles.buttonText}>检查更新</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity
          testID="standard-restart-btn"
          accessibilityLabel="standard-restart-btn"
          style={styles.button}
          onPress={() => record('restartApp', restartApp())}>
          <Text style={styles.buttonText}>重启应用</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="standard-reset-btn"
          accessibilityLabel="standard-reset-btn"
          style={styles.button}
          onPress={() =>
            record('resetToPackagedBundle', resetToPackagedBundle())
          }>
          <Text style={styles.buttonText}>回退内置包</Text>
        </TouchableOpacity>
      </View>

      {actionLog.length > 0 ? (
        <View testID="standard-action-log" accessibilityLabel="standard-action-log">
          {actionLog.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.constantText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DemoPage() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [constants, setConstants] = useState<Record<string, unknown>>({});
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [listening, setListening] = useState(false);

  // 三种下载方式分别保留真机验证过的参数，互不覆盖。
  const [fullDownload, setFullDownload] = useState({
    updateUrl: 'https://dl.reactnative.cn/A',
    hash: 'A',
  });
  const [ppkDownload, setPpkDownload] = useState({
    updateUrl:
      'https://dl.reactnative.cn/A-B.hdiff',
    hash: 'B',
    originHash: 'A',
  });
  const [packageDownload, setPackageDownload] = useState({
    updateUrl:
      'https://dl.reactnative.cn/C_A.phdiff',
    hash: 'A',
  });
  // 安装记录与版本切换使用的 hash，由各自按钮下的输入框编辑。
  const [hash, setHash] = useState('A');
  const [appKey, setAppKey] = useState(initialAppKey);

  const nativeConfigJson = useCallback(
    () => JSON.stringify({ appKey, endpoints: ['https://update.react-native.cn/api'] }),
    [appKey],
  );

  const refreshConstants = useCallback((): Record<string, unknown> => {
    if (!PushyModule) {
      return { error: 'PushyModule not available' };
    }
    const consts = PushyModule.getConstants();
    setConstants(consts as Record<string, unknown>);
    return consts as Record<string, unknown>;
  }, []);

  useEffect(() => {
    refreshConstants();
  }, [refreshConstants]);

  const runMethod = useCallback(async (slug: string, fn: () => unknown) => {
    setResults(prev => ({ ...prev, [slug]: 'running...' }));
    try {
      const value = await fn();
      setResults(prev => ({
        ...prev,
        [slug]: `${value === null ? 'Pass' : formatValue(value)}`,
      }));
    } catch (e) {
      setResults(prev => ({ ...prev, [slug]: `Error: ${errMsg(e)}` }));
    }
  }, []);

  // appKey 输入实时同步到共享客户端：记住最后一次取值，供 fast refresh 后
  // 以同一 appKey 重建单例；setOptions 触发原生冷启动配置重新下发。
  const applyAppKey = useCallback((value: string) => {
    setAppKey(value);
    globalStore[APPKEY_GLOBAL_KEY] = value;
    pushyClient.setOptions({ appKey: value });
  }, []);

  // 下载进度事件监听：鸿蒙端走 DeviceEventEmitter；卸载/取消订阅时移除（§1.7 生命周期）
  useEffect(() => {
    if (!listening || !PushyModule) {
      return;
    }
    PushyModule.addListener('RCTPushyDownloadProgress');
    const subscription = DeviceEventEmitter.addListener(
      'RCTPushyDownloadProgress',
      (e: DownloadProgressEvent) => {
        setProgressLog(prev =>
          [
            `${e.received}/${e.total} (${e.hash})`,
            ...prev,
          ].slice(0, 6),
        );
      },
    );
    return () => {
      subscription.remove();
      PushyModule?.removeListeners(1);
    };
  }, [listening]);

  const hashInputs = [
    { key: 'hash', label: 'hash（目标版本标识）', value: hash, onChangeText: setHash },
  ];

  const methods: MethodCase[] = [
    {
      slug: 'getConstants',
      label: 'Run getConstants',
      testID: 'test-getConstants-btn',
      note: '读取原生常量集（11 项）',
      run: () => refreshConstants(),
    },
    {
      slug: 'setLocalHashInfo',
      label: 'Run setLocalHashInfo',
      testID: 'test-setLocalHashInfo-btn',
      inputs: hashInputs,
      note: `按 hash 写入安装记录：${JSON.stringify({
        name: 'Example Release',
        description: 'written by ohos example',
      })}`,
      run: () =>
        PushyModule?.setLocalHashInfo(
          hash,
          JSON.stringify({
            name: 'Example Release',
            description: 'written by ohos example',
          }),
        ),
    },
    {
      slug: 'getLocalHashInfo',
      label: 'Run getLocalHashInfo',
      testID: 'test-getLocalHashInfo-btn',
      inputs: hashInputs,
      note: '读取当前 hash 的安装记录（无记录返回空串）',
      run: () => PushyModule?.getLocalHashInfo(hash),
    },
    {
      slug: 'setUuid',
      label: 'Run setUuid',
      testID: 'test-setUuid-btn',
      note: '持久化灰度统计 uuid',
      run: () => PushyModule?.setUuid('example-uuid-0001'),
    },
    {
      slug: 'syncNativeConfig',
      label: 'Run syncNativeConfig',
      testID: 'test-syncNativeConfig-btn',
      note: '持久化原生冷启动检查配置（appKey + https endpoints）',
      run: () => PushyModule?.syncNativeConfig(nativeConfigJson()),
    },
    {
      slug: 'markJsCheckCompleted',
      label: 'Run markJsCheckCompleted',
      testID: 'test-markJsCheckCompleted-btn',
      note: '标记本轮 JS 检查已完成',
      run: () => PushyModule?.markJsCheckCompleted(nativeConfigJson()),
    },
    {
      slug: 'getNativeCheckCache',
      label: 'Run getNativeCheckCache',
      testID: 'test-getNativeCheckCache-btn',
      note: '读取原生冷启动检查缓存（缺省空串，永不 reject）',
      run: () => PushyModule?.getNativeCheckCache(),
    },
    {
      slug: 'reloadUpdate',
      label: 'Run reloadUpdate',
      testID: 'test-reloadUpdate-btn',
      inputs: hashInputs,
      note: '切换到指定 hash 并立即重启应用（点击后应用会重启）',
      run: () => PushyModule?.reloadUpdate({ hash }),
    },
    {
      slug: 'restartApp',
      label: 'Run restartApp(重启应用)',
      testID: 'test-restartApp-btn',
      note: '重启应用（点击后应用会重启）',
      run: () => PushyModule?.restartApp(),
    },
    {
      slug: 'setNeedUpdate',
      label: 'Run setNeedUpdate',
      testID: 'test-setNeedUpdate-btn',
      inputs: hashInputs,
      note: '标记下次启动使用指定 hash（不重启）',
      run: () => PushyModule?.setNeedUpdate({ hash }),
    },
    {
      slug: 'markSuccess',
      label: 'Run markSuccess',
      testID: 'test-markSuccess-btn',
      note: '标记当前版本运行成功（写完成记录；DEV 下 JS 层为 no-op）',
      run: () => PushyModule?.markSuccess(),
    },
    {
      slug: 'getBundleHash',
      label: 'Run getBundleHash',
      testID: 'test-getBundleHash-btn',
      note: '内置 JS bundle 的 sha256（未知时为空串，永不 reject）',
      run: () => PushyModule?.getBundleHash(),
    },
    {
      slug: 'resetToPackagedBundle',
      label: 'Run resetToPackagedBundle(回退内置包)',
      testID: 'test-resetToPackagedBundle-btn',
      note: '清空更新目录并回退到内置 bundle',
      run: () => PushyModule?.resetToPackagedBundle(),
    },
    {
      slug: 'downloadPatchFromPpk',
      label: 'Run downloadPatchFromPpk',
      testID: 'test-downloadPatchFromPpk-btn',
      note: '热更包差分测试：先运行全量下载得到 autotest-full-a；目标 B 用于回滚测试。',
      inputs: [
        {
          key: 'updateUrl', label: 'updateUrl（热更包差分地址）', value: ppkDownload.updateUrl,
          onChangeText: value => setPpkDownload(prev => ({ ...prev, updateUrl: value })),
        },
        {
          key: 'hash', label: 'hash（目标版本标识）', value: ppkDownload.hash,
          onChangeText: value => setPpkDownload(prev => ({ ...prev, hash: value })),
        },
        {
          key: 'originHash', label: 'originHash（已下载的基准版本标识）', value: ppkDownload.originHash,
          onChangeText: value => setPpkDownload(prev => ({ ...prev, originHash: value })),
        },
      ],
      run: () =>
        PushyModule?.downloadPatchFromPpk({ ...ppkDownload }),
    },
    {
      slug: 'downloadPatchFromPackage',
      label: 'Run downloadPatchFromPackage',
      testID: 'test-downloadPatchFromPackage-btn',
      note: '原生包差分测试',
      inputs: [
        {
          key: 'updateUrl', label: 'updateUrl（原生包差分地址）', value: packageDownload.updateUrl,
          onChangeText: value => setPackageDownload(prev => ({ ...prev, updateUrl: value })),
        },
        {
          key: 'hash', label: 'hash（目标版本标识）', value: packageDownload.hash,
          onChangeText: value => setPackageDownload(prev => ({ ...prev, hash: value })),
        },
      ],
      run: () =>
        PushyModule?.downloadPatchFromPackage({ ...packageDownload }),
    },
    {
      slug: 'downloadFullUpdate',
      label: 'Run downloadFullUpdate',
      testID: 'test-downloadFullUpdate-btn',
      note: '全量下载测试-全量ppk下载解压（需真实服务端）',
      inputs: [
        {
          key: 'updateUrl', label: 'updateUrl（全量包地址）', value: fullDownload.updateUrl,
          onChangeText: value => setFullDownload(prev => ({ ...prev, updateUrl: value })),
        },
        {
          key: 'hash', label: 'hash（目标版本标识）', value: fullDownload.hash,
          onChangeText: value => setFullDownload(prev => ({ ...prev, hash: value })),
        },
      ],
      run: () => PushyModule?.downloadFullUpdate({ ...fullDownload }),
    }
  ];

  const renderResult = (slug: string) => {
    const value = results[slug];
    if (!value) {
      return null;
    }
    const isError = value.startsWith('Error:');
    const isRunning = value === 'running...';
    return (
      <View
        testID={`result-${slug}-box`}
        accessibilityLabel={`result-${slug}-box`}>
        <Text style={isError ? styles.errorLabel : styles.resultLabel}>
          {isError ? 'Error:' : isRunning ? 'Status:' : 'Result:'}
        </Text>
        <Text
          testID={isError ? `error-${slug}` : isRunning ? `status-${slug}` : `result-${slug}`}
          accessibilityLabel={
            isError ? `error-${slug}` : isRunning ? `status-${slug}` : `result-${slug}`
          }
          style={isError ? styles.errorText : styles.resultText}>
          {value}
        </Text>
      </View>
    );
  };

  if (!PushyModule) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>PushyModule not available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text testID="app-title" accessibilityLabel="app-title" style={styles.title}>
          {PAGE_TITLE}
        </Text>
        <Text style={styles.subtitle}>
          Platform: {Platform.OS} ({Platform.Version})
        </Text>
      </View>

      <StandardFlowSection />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>getConstants 常量面板</Text>
        <View testID="constants-box" accessibilityLabel="constants-box">
          {Object.keys(constants).map(key => (
            <Text key={key} style={styles.constantText}>
              {key}: {formatValue(constants[key])}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>测试输入</Text>
        <Text style={styles.inputLabel}>appKey（标准接入用，输入后实时生效）</Text>
        <TextInput
          testID="input-appKey"
          style={styles.input}
          value={appKey}
          onChangeText={applyAppKey}
          autoCapitalize="none"
          placeholder="pushy.reactnative.cn 控制台的 appKey"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>下载进度事件</Text>
        <View style={styles.row}>
          <TouchableOpacity
            testID="test-addListener-btn"
            accessibilityLabel="test-addListener-btn"
            style={[styles.button, styles.primaryButton]}
            onPress={() => {
              setProgressLog([]);
              setListening(true);
              setResults(prev => ({
                ...prev,
                addListener: 'Success: subscribed RCTPushyDownloadProgress',
              }));
            }}>
            <Text style={styles.buttonText}>Run addListener</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="test-removeListeners-btn"
            accessibilityLabel="test-removeListeners-btn"
            style={[
              styles.button,
              listening ? styles.primaryButton : styles.disabledButton,
            ]}
            onPress={() => {
              setListening(false);
              setResults(prev => ({
                ...prev,
                removeListeners: 'Success: unsubscribed',
              }));
            }}>
            <Text style={styles.buttonText}>Run removeListeners</Text>
          </TouchableOpacity>
        </View>
        {renderResult('addListener')}
        {renderResult('removeListeners')}
        <View testID="progress-log-box" accessibilityLabel="progress-log-box">
          {progressLog.length === 0 ? (
            <Text style={styles.constantText}>（暂无进度事件，先订阅再触发下载）</Text>
          ) : (
            progressLog.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.constantText}>
                progress: {line}
              </Text>
            ))
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TurboModule 方法（Pushy 通道）</Text>
        {methods.map(method => (
          <View key={method.slug} style={styles.card}>
            <TouchableOpacity
              testID={method.testID}
              accessibilityLabel={method.testID}
              style={styles.button}
              onPress={() => runMethod(method.slug, method.run)}>
              <Text style={styles.buttonText}>{method.label}</Text>
            </TouchableOpacity>
            {method.inputs?.map(input => (
              <View key={input.key}>
                <Text style={styles.inputLabel}>{input.label}</Text>
                <TextInput
                  testID={`input-${method.slug}-${input.key}`}
                  accessibilityLabel={`input-${method.slug}-${input.key}`}
                  style={styles.input}
                  value={input.value}
                  onChangeText={input.onChangeText}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
            {method.note ? (
              <Text style={styles.noteText}>{method.note}</Text>
            ) : null}
            {renderResult(method.slug)}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function App() {
  return (
    <PushyProvider client={pushyClient}>
      <DemoPage />
    </PushyProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f6f7',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d4d9',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1c1e21',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#606770',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1e21',
    marginBottom: 8,
  },
  card: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e4e6eb',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#2f6fed',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryButton: {
    backgroundColor: '#2f6fed',
  },
  disabledButton: {
    backgroundColor: '#9aa4b2',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  pickerButton: {
    backgroundColor: '#eef3fe',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ccd9f7',
  },
  pickerButtonActive: {
    backgroundColor: '#2f6fed',
    borderColor: '#2f6fed',
  },
  pickerButtonText: {
    color: '#2f6fed',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerButtonTextActive: {
    color: '#ffffff',
  },
  statusText: {
    fontSize: 13,
    color: '#1c1e21',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fdecea',
  },
  inputLabel: {
    fontSize: 12,
    color: '#606770',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccd2da',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1c1e21',
    backgroundColor: '#fafbfc',
  },
  noteText: {
    marginTop: 6,
    fontSize: 12,
    color: '#606770',
  },
  resultLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
  },
  errorLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#c62828',
  },
  resultText: {
    marginTop: 2,
    fontSize: 12,
    color: '#1c1e21',
  },
  errorText: {
    marginTop: 2,
    fontSize: 12,
    color: '#c62828',
  },
  constantText: {
    fontSize: 12,
    color: '#444950',
    marginTop: 2,
  },
});

export default App;
