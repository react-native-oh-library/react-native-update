# @oh-rn/react-native-update for HarmonyOS

本项目基于 [react-native-update（pushy 热更新）](https://github.com/reactnativecn/react-native-update) v10.56.1 开发，为 React Native 鸿蒙（OpenHarmony）适配版本，提供 RN 应用 JS bundle 热更新能力（全量 ppk 更新、差分 pdiff 更新、版本管理与回滚）。

## 版本对应关系

| 鸿蒙适配包版本 | 原始库版本 | 支持 RN 版本 | Autolink | 编译 API 版本 |
| ------------ | ---------- | ------------ | -------- | ------------- |
| 10.56.1 | react-native-update 10.56.1 | 0.72+（RNOH >= 0.72.96） | 是 | API 12+（HarmonyOS 5.0.1+） |

## 安装

```bash
npm install @oh-rn/react-native-update
```

## 使用

```tsx
import { Pushy, PushyProvider, useUpdate } from '@oh-rn/react-native-update';

// 1. 在应用入口用 Provider 包裹（自动检查更新 + 下载进度 + 自动 markSuccess）
const client = new Pushy({ appKey: '你的 appKey' });

function App() {
  return (
    <PushyProvider client={client}>
      <Router />
    </PushyProvider>
  );
}

// 2. 页面中消费更新状态
function UpdateBanner() {
  const { update, progress, checkUpdate, switchVersion, switchVersionLater } = useUpdate();
  if (!update) {
    return null;
  }
  return (
    <View>
      <Text>发现新版本 {update.name}</Text>
      <Button title="立即更新" onPress={() => switchVersion(update.hash)} />
      <Button title="下次启动生效" onPress={() => switchVersionLater(update.hash)} />
      <Text>下载进度：{progress.received}/{progress.total}</Text>
    </View>
  );
}
```

注意事项：

- 鸿蒙端（`Platform.OS === 'harmony'`）下载进度事件通过 `DeviceEventEmitter` 监听 `RCTPushyDownloadProgress`，JS 层已内置平台分支，业务代码无需处理。
- 宿主应用需在 `entry/src/main/module.json5` 声明 `ohos.permission.INTERNET`（normal 级，免用户授权）。
- `downloadAndInstallApk` 为 Android 专属能力，鸿蒙端调用将 reject `UNSUPPORTED_PLATFORM`（与 iOS 行为一致）。

## Link

| 版本 | 是否支持 Autolink |
|------|------------------|
| 10.56.1 | 是 |

本模块 `package.json` 已声明 `harmony.autolinking`（`cmakeLibraryTargetName: update` / `etsPackageClassName: UpdatePackage`），RNOH 工程直接安装 npm 包即可自动注册，无需手动配置。

<details>
<summary>Manual Link 配置</summary>

> **说明**：本模块需要同时在 C++ 侧和 ETS 侧注册 Package。

### 1. Overrides RN SDK

在工程根目录 `oh-package.json5` 添加：

```json
{
  "overrides": {
    "@rnoh/react-native-openharmony": "./react_native_openharmony"
  }
}
```

### 2. 引入原生端依赖

打开 `entry/oh-package.json5`，添加：

```json
"dependencies": {
  "@oh-rn/react-native-update": "file:../../node_modules/@oh-rn/react-native-update/harmony/update.har"
}
```

执行 `ohpm install`。

### 3. 配置 CMakeLists

打开 `entry/src/main/cpp/CMakeLists.txt`，添加：

```cmake
set(OH_MODULES "${CMAKE_CURRENT_SOURCE_DIR}/../../../oh_modules")

add_subdirectory("${OH_MODULES}/@oh-rn/react-native-update/src/main/cpp" ./update)

target_link_libraries(rnoh_app PUBLIC update)
```

### 4. 注册 Package（C++ 侧）

打开 `entry/src/main/cpp/PackageProvider.cpp`，添加：

```cpp
#include "UpdatePackage.h"

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(Package::Context ctx) {
    return {
        std::make_shared<UpdatePackage>(ctx),
    };
}
```

### 5. 注册 Package（ETS 侧）

打开 `entry/src/main/ets/RNPackagesFactory.ets`，添加：

```typescript
import { UpdatePackage } from '@oh-rn/react-native-update/ts';

export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
  return [
    new UpdatePackage(ctx),
  ];
}
```

### 6. 配置热更新 bundle 回退链（可选，启用热更新必需）

打开 `entry/src/main/ets/pages/Index.ets`，在 `AnyJSBundleProvider` 链中 `MetroJSBundleProvider` 之后插入：

```typescript
import { PushyFileJSBundleProvider } from '@oh-rn/react-native-update';

jsBundleProvider: new TraceJSBundleProviderDecorator(
  new AnyJSBundleProvider([
    new MetroJSBundleProvider(),
    new PushyFileJSBundleProvider(this.rnohCoreContext.uiAbilityContext), // 热更新 bundle
    new ResourceJSBundleProvider(this.rnohCoreContext.uiAbilityContext.resourceManager, 'bundle.harmony.js'),
  ]),
  this.rnohCoreContext.logger),
```

</details>

## 属性 / API

TurboModule 通道名 `Pushy`（与 JS Spec `TurboModuleRegistry.get('Pushy')` 一致），全部 19 个方法均已在鸿蒙端实现：

| API | 描述 | 参数 | 返回值 | HarmonyOS 支持 |
|-----|------|------|--------|----------------|
| getConstants | 读取原生常量集（downloadRootDir/packageVersion/currentVersion 等 11 项） | 无 | Object | 是 |
| setLocalHashInfo | 写入指定 hash 的安装记录 | hash, info(JSON 字符串) | Promise\<void\> | 是 |
| getLocalHashInfo | 读取指定 hash 的安装记录 | hash | Promise\<string\>（无记录空串） | 是 |
| setUuid | 持久化灰度统计 uuid | uuid | Promise\<void\> | 是 |
| syncNativeConfig | 持久化原生冷启动检查配置 | config(JSON 字符串) | Promise\<void\> | 是 |
| markJsCheckCompleted | 标记本轮 JS 检查已完成 | config(JSON 字符串) | Promise\<void\> | 是 |
| getNativeCheckCache | 读取原生冷启动检查缓存 | 无 | Promise\<string\>（缺省空串） | 是 |
| reloadUpdate | 切换到指定 hash 并立即重启 | {hash} | Promise\<void\> | 是 |
| restartApp | 重启应用 | 无 | Promise\<void\> | 是 |
| setNeedUpdate | 标记下次启动使用指定 hash | {hash} | Promise\<void\> | 是 |
| markSuccess | 标记当前版本运行成功 | 无 | Promise\<void\> | 是 |
| getBundleHash | 内置 JS bundle 的 sha256 | 无 | Promise\<string\>（未知空串） | 是 |
| resetToPackagedBundle | 清空更新目录并回退内置 bundle | 无 | Promise\<void\> | 是 |
| downloadPatchFromPpk | 下载 ppk 差分包并合并 | {updateUrl, hash, originHash} | Promise\<void\> | 是 |
| downloadPatchFromPackage | 基于内置 rawfile 包生成差分 | {updateUrl, hash} | Promise\<void\> | 是 |
| downloadFullUpdate | 全量 ppk 下载解压 | {updateUrl, hash} | Promise\<void\> | 是 |
| downloadAndInstallApk | 下载并安装 APK 整包 | {url, target, hash} | Promise\<void\> | 否（reject UNSUPPORTED_PLATFORM） |
| addListener | 订阅原生事件（RCTPushyDownloadProgress） | eventName | void | 是 |
| removeListeners | 取消事件订阅 | count | void | 是 |

JS 层完整 API（`Pushy` 类的 `checkUpdate`/`switchVersion`/`switchVersionLater`、`PushyProvider`/`useUpdate` 等）与上游一致，详见上游文档。

API 说明：

- 差分核心（HDiffPatch + LZMA）与 Android 端共用同源 C++ 实现，编译为 `librnupdate.so` 随宿主 App 经 CMake autolinking 一起构建。
- 差分（pdiff）依赖 Hermes 字节码格式，RNOH 打包器字节码版本差异可能导致差分合并失败；集成验证建议先走全量 ppk 通道。

## 快速验证（运行 Example）

### 前置条件

| 依赖 | 版本要求 |
|------|----------|
| Node.js | >= 20 |
| DevEco Studio | 6.0+（本验证基于 6.0.1.260，hvigor modelVersion 6.0.1） |
| HarmonyOS SDK | API 21（compatibleSdkVersion 5.0.1(13)） |
| Python | 3.x（运行 rn.py 编排脚本） |

### 运行步骤

**1. 克隆仓库并初始化子模块**（差分引擎源码位于 git submodule）

```bash
git clone <仓库地址>
cd <仓库目录>
git submodule update --init --recursive
```

**2. 编译库 HAR**

```bash
python .claude/skills/tool-ohos-plugin-repo/tool/rn.py build har --plugin-root .
```

产物：`ohos/harmony/update.har`

**3. 编译 Example HAP**（自动完成 pack tgz → npm install → bundle → assembleHap）

```bash
export DEVECO_SDK_HOME="<DevEco Studio 安装目录>/sdk"
python .claude/skills/tool-ohos-plugin-repo/tool/rn.py build hap --full --plugin-root .
```

产物：`ohos/example/harmony/entry/build/default/outputs/default/entry-default-signed.hap`

**4. 安装到设备**

```bash
hdc install -r ohos/example/harmony/entry/build/default/outputs/default/entry-default-signed.hap
```

Example 测试页（`ohos/example/App.tsx`）提供：

- `getConstants` 常量面板（11 项原生常量）
- 19 个 TurboModule 方法的逐一测试按钮（`test-{method}-btn`）与 Result/Error 展示
- `RCTPushyDownloadProgress` 下载进度事件订阅/取消面板
- `jsCheckUpdate` JS 层全链路（创建 Pushy 客户端并检查更新）入口
- 可编辑的 updateUrl / hash / originHash / appKey 输入框（接入真实热更新服务后可验证下载、差分、切换、回滚全链路）

## 约束与限制

### 兼容性

- RNOH: >= 0.72.96（Example 基于 RN 0.72.5 + @rnoh/react-native-openharmony 0.72.x）
- HarmonyOS SDK: API 12+
- 差分 pdiff 依赖 Hermes 字节码格式（hbc_transform），与 RNOH 打包器字节码版本相关，失败时回退全量 ppk 通道

### 权限

| 权限 | 级别 | 说明 |
|------|------|------|
| ohos.permission.INTERNET | normal | 热更新包下载必需，由宿主 App 在 entry module.json5 声明（HAR 自身不声明） |

## 遗留问题

- `downloadAndInstallApk` 为 Android 专属能力（APK 整包安装），鸿蒙端与 iOS 同样 reject `UNSUPPORTED_PLATFORM`，非缺陷。
- Expo 模块增强（expo-module.config.json 仅声明 apple/android 平台）鸿蒙端不接入，JS 层特性检测自动跳过，不影响热更新核心链路。

## 开源协议

本项目基于 [react-native-update（MIT）](https://github.com/reactnativecn/react-native-update/blob/master/LICENSE)，详见 [LICENSE](./LICENSE) 文件。
