/**
 * react-native-update（Pushy 热更新）OpenHarmony Example 测试页
 *
 * 覆盖 03-coding-library implemented_methods 的全部 19 个 TurboModule 方法：
 * 每个方法一个 Run 按钮（testID: test-{method}-btn），结果写入 Result:/Error: 区块；
 * 下载进度事件走鸿蒙 DeviceEventEmitter（RCTPushyDownloadProgress），
 * 订阅在组件卸载或手动取消时移除。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from '@oh-rn/react-native-update';

const PAGE_TITLE = 'React Native Update 热更新测试';

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

function App(): JSX.Element {
  const [results, setResults] = useState<Record<string, string>>({});
  const [constants, setConstants] = useState<Record<string, unknown>>({});
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [listening, setListening] = useState(false);

  // 测试输入（device-verify 阶段可替换为真实热更新服务地址）
  const [updateUrl, setUpdateUrl] = useState('https://example.com/full.ppk');
  const [hash, setHash] = useState('example-hash-001');
  const [originHash, setOriginHash] = useState('example-hash-000');
  const [appKey, setAppKey] = useState('example-app-key');

  const pushyClientRef = useRef<Pushy | null>(null);

  const nativeConfigJson = useCallback(
    () => JSON.stringify({ appKey, endpoints: ['https://update.reactnative.cn/api'] }),
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
        [slug]: `Success: ${formatValue(value)}`,
      }));
    } catch (e) {
      setResults(prev => ({ ...prev, [slug]: `Error: ${errMsg(e)}` }));
    }
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
      note: '切换到指定 hash 并立即重启应用（点击后应用会重启）',
      run: () => PushyModule?.reloadUpdate({ hash }),
    },
    {
      slug: 'restartApp',
      label: 'Run restartApp',
      testID: 'test-restartApp-btn',
      note: '重启应用（点击后应用会重启）',
      run: () => PushyModule?.restartApp(),
    },
    {
      slug: 'setNeedUpdate',
      label: 'Run setNeedUpdate',
      testID: 'test-setNeedUpdate-btn',
      note: '标记下次启动使用指定 hash（不重启）',
      run: () => PushyModule?.setNeedUpdate({ hash }),
    },
    {
      slug: 'markSuccess',
      label: 'Run markSuccess',
      testID: 'test-markSuccess-btn',
      note: '标记当前版本运行成功（写完成记录）',
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
      label: 'Run resetToPackagedBundle',
      testID: 'test-resetToPackagedBundle-btn',
      note: '清空更新目录并回退到内置 bundle',
      run: () => PushyModule?.resetToPackagedBundle(),
    },
    {
      slug: 'downloadPatchFromPpk',
      label: 'Run downloadPatchFromPpk',
      testID: 'test-downloadPatchFromPpk-btn',
      note: '从 ppk 差分包下载合并（需真实服务端）',
      run: () =>
        PushyModule?.downloadPatchFromPpk({
          updateUrl,
          hash,
          originHash,
        }),
    },
    {
      slug: 'downloadPatchFromPackage',
      label: 'Run downloadPatchFromPackage',
      testID: 'test-downloadPatchFromPackage-btn',
      note: '从内置 rawfile 包生成差分（需预置资源）',
      run: () =>
        PushyModule?.downloadPatchFromPackage({
          updateUrl,
          hash,
        }),
    },
    {
      slug: 'downloadFullUpdate',
      label: 'Run downloadFullUpdate',
      testID: 'test-downloadFullUpdate-btn',
      note: '全量 ppk 下载解压（需真实服务端）',
      run: () => PushyModule?.downloadFullUpdate({ updateUrl, hash }),
    },
    {
      slug: 'downloadAndInstallApk',
      label: 'Run downloadAndInstallApk',
      testID: 'test-downloadAndInstallApk-btn',
      note: 'Android 专属能力，鸿蒙端预期 reject UNSUPPORTED_PLATFORM',
      run: () =>
        PushyModule?.downloadAndInstallApk({
          url: updateUrl,
          target: 'apk',
          hash,
        }),
    },
    {
      slug: 'jsCheckUpdate',
      label: 'Run jsCheckUpdate',
      testID: 'test-jsCheckUpdate-btn',
      note: 'JS 层全链路：创建 Pushy 客户端并检查更新（默认服务器）',
      run: async () => {
        if (!pushyClientRef.current) {
          pushyClientRef.current = new Pushy({ appKey });
        }
        const result = await pushyClientRef.current.checkUpdate();
        return result ?? 'undefined (check skipped)';
      },
    },
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
        <Text style={styles.inputLabel}>updateUrl</Text>
        <TextInput
          testID="input-updateUrl"
          style={styles.input}
          value={updateUrl}
          onChangeText={setUpdateUrl}
          autoCapitalize="none"
          placeholder="热更新服务地址"
        />
        <Text style={styles.inputLabel}>hash</Text>
        <TextInput
          testID="input-hash"
          style={styles.input}
          value={hash}
          onChangeText={setHash}
          autoCapitalize="none"
          placeholder="目标版本 hash"
        />
        <Text style={styles.inputLabel}>originHash（ppk 差分基准）</Text>
        <TextInput
          testID="input-originHash"
          style={styles.input}
          value={originHash}
          onChangeText={setOriginHash}
          autoCapitalize="none"
          placeholder="当前已装版本 hash"
        />
        <Text style={styles.inputLabel}>appKey（JS 层检查更新用）</Text>
        <TextInput
          testID="input-appKey"
          style={styles.input}
          value={appKey}
          onChangeText={setAppKey}
          autoCapitalize="none"
          placeholder="热更新服务 appKey"
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
    gap: 8,
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
