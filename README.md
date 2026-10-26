> 文档模板：v0.4.2

<p align="center">
  <h1 align="center"> <code>react-native-update</code> </h1>
</p>

本项目基于 [react-native-update](https://github.com/reactnativecn/react-native-update) 开发。

版本所属关系如下：

| 三方库名称    | 三方库版本（npm地址）    | 发布信息     | 支持RN版本    | Autolink     | 编译API版本     | 社区基线版本    |  源码地址   |
| ------------ | ------------ | ------------------------------ | ------------- | ------------- |------------------------ | ------------- | ------------- | 
| @react-native-ohos/react-native-update | [10.56.1（开发中）](https://www.npmjs.com/package/@react-native-ohos/react-native-update)    | [GitHub Releases](https://github.com/react-native-oh-library/react-native-update/releases) | 0.72.\*/0.77.\*/0.82.\*/0.84.\* | 是 | API12+ | 10.56.1 | [master](https://github.com/react-native-oh-library/react-native-update/tree/master) |

## 简介

react-native-update 是 [热更新服务 Pushy](https://pushy.reactnative.cn/) 的官方客户端库，为 React Native 应用提供 JS bundle 热更新能力。<br/>

## 下载安装

进入到工程目录并输入以下命令：

**npm**

```bash
npm install @react-native-ohos/react-native-update
```

**yarn**

```bash
yarn add @react-native-ohos/react-native-update
```

## Link

|                                      | 是否支持autolink | RN框架版本 |
|--------------------------------------|----------------|-----------|
| 10.56.1                              | Yes            |  0.72/0.77/0.82/0.84     |

使用AutoLink的工程需要根据该文档配置，Autolink框架指导文档：https://gitcode.com/CPF-RN/ohos_react_native/blob/master/docs/zh-cn/Autolinking.md

如您使用的版本支持 Autolink，并且工程已接入 Autolink，可跳过ManualLink配置。

<details>
  <summary>ManualLink: 此步骤为手动配置原生依赖项的指导</summary>

首先需要使用 DevEco Studio 打开项目里的 HarmonyOS 工程 `harmony`。

### 1. Overrides RN SDK

为了让工程依赖同一个版本的 RN SDK，需要在工程根目录的 `oh-package.json5` 添加 overrides 字段，指向工程需要使用的 RN SDK 版本。替换的版本既可以是一个具体的版本号，也可以是一个模糊版本，还可以是本地存在的 HAR 包或源码目录。

关于该字段的作用请阅读[官方说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-oh-package-json5-V5#zh-cn_topic_0000001792256137_overrides)

```json
{
  "overrides": {
    "@rnoh/react-native-openharmony": "file:../node_modules/@react-native-oh/react-native-harmony/react_native_openharmony.har" // ohpm 在线版本
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony.har" // 指向本地 har 包的路径
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony" // 指向源码路径
  }
}
```

### 2. 引入原生端代码

目前有两种方法：

- 通过 har 包引入；
- 直接链接源码。

方法一：通过 har 包引入（推荐）

> [!TIP] har 包位于三方库安装路径的 `harmony` 文件夹下。

打开 `entry/oh-package.json5`，添加以下依赖

```json
"dependencies": {
    "@react-native-ohos/react-native-update": "file:../../node_modules/@react-native-ohos/react-native-update/harmony/rnoh_update.har"
}
```

点击右上角的 `sync` 按钮

或者在命令行终端执行：

```bash
cd entry
ohpm install
```

方法二：直接链接源码

> [!TIP] 如需使用直接链接源码，请参考[直接链接源码说明](https://gitcode.com/CPF-RN/usage-docs/blob/master/zh-cn/link-source-code.md)

### 3. 配置 CMakeLists 和引入 UpdatePackage

打开 `entry/src/main/cpp/CMakeLists.txt`，添加：

```diff
project(rnapp)
cmake_minimum_required(VERSION 3.4.1)
set(CMAKE_SKIP_BUILD_RPATH TRUE)
set(RNOH_APP_DIR "${CMAKE_CURRENT_SOURCE_DIR}")
set(NODE_MODULES "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules")
+ set(OH_MODULES "${CMAKE_CURRENT_SOURCE_DIR}/../../../oh_modules")
set(RNOH_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../../react-native-harmony/harmony/cpp")
set(LOG_VERBOSITY_LEVEL 1)
set(CMAKE_ASM_FLAGS "-Wno-error=unused-command-line-argument -Qunused-arguments")
set(CMAKE_CXX_FLAGS "-fstack-protector-strong -Wl,-z,relro,-z,now,-z,noexecstack -s -fPIE -pie")
set(WITH_HITRACE_SYSTRACE 1) # for other CMakeLists.txt files to use
add_compile_definitions(WITH_HITRACE_SYSTRACE)

add_subdirectory("${RNOH_CPP_DIR}" ./rn)

# RNOH_BEGIN: manual_package_linking_1
add_subdirectory("../../../../sample_package/src/main/cpp" ./sample-package)
+ add_subdirectory("${OH_MODULES}/@react-native-ohos/react-native-update/src/main/cpp" ./update)
# RNOH_END: manual_package_linking_1

file(GLOB GENERATED_CPP_FILES "./generated/*.cpp")

add_library(rnoh_app SHARED
    ${GENERATED_CPP_FILES}
    "./PackageProvider.cpp"
    "${RNOH_CPP_DIR}/RNOHAppNapiBridge.cpp"
)
target_link_libraries(rnoh_app PUBLIC rnoh)

# RNOH_BEGIN: manual_package_linking_2
target_link_libraries(rnoh_app PUBLIC rnoh_sample_package)
+ target_link_libraries(rnoh_app PUBLIC rnoh_update)
# RNOH_END: manual_package_linking_2
```

打开 `entry/src/main/cpp/PackageProvider.cpp`，添加：

```diff
#include "RNOH/PackageProvider.h"
#include "SamplePackage.h"
+ #include "UpdatePackage.h"

using namespace rnoh;

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(Package::Context ctx) {
    return {
      std::make_shared<SamplePackage>(ctx),
+     std::make_shared<UpdatePackage>(ctx)
    };
}
```

### 4. 在 ArkTs 侧引入 UpdatePackage

打开 `entry/src/main/ets/RNPackagesFactory.ts`，添加：

```diff
  ...
+ import { UpdatePackage } from '@react-native-ohos/react-native-update/ts';

export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
  return [
+    new UpdatePackage(ctx)
  ];
}
```

### 5. 配置热更新 bundle 回退链（启用热更新必需）

本库通过 `PushyFileJSBundleProvider` 从热更新目录加载新版 bundle。打开 `entry/src/main/ets/pages/Index.ets`（或 `entry/src/main/ets/rn/LoadBundle.ets`），在 `AnyJSBundleProvider` 链中 `MetroJSBundleProvider` 之后插入：

```diff
+ import { PushyFileJSBundleProvider } from '@react-native-ohos/react-native-update';

jsBundleProvider: new TraceJSBundleProviderDecorator(
  new AnyJSBundleProvider([
    new MetroJSBundleProvider(),
+   new PushyFileJSBundleProvider(this.rnohCoreContext.uiAbilityContext), // 热更新 bundle
    new ResourceJSBundleProvider(this.rnohCoreContext.uiAbilityContext.resourceManager, 'bundle.harmony.js'),
  ]),
  this.rnohCoreContext.logger),
```
</details>

### 运行

点击右上角的 `sync` 按钮

或者在命令行终端执行：

```bash
cd entry
ohpm install
```

然后编译、运行即可。

## 约束与限制

### 兼容性

本文档内容基于以下版本验证通过：

1.RNOH: 0.84.2; SDK: HarmonyOS 6.0.1 Release SDK; IDE: DevEco Studio 6.0.1.260; ROM:6.0.0.130;
2.RNOH: 0.82.22; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.878; ROM: 6.0.0.130;
3.RNOH: 0.77.18; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.858; ROM: 6.0.0.112;
4.RNOH: 0.72.33; SDK: HarmonyOS NEXT B1; IDE: DevEco Studio: 5.0.3.900; ROM: Next.0.0.71;

### 权限要求

- 热更新包通过网络 url 下载，应用需要申请网络权限（normal 级，免用户授权），由宿主 App 在 entry 模块声明（HAR 自身不声明）

  在`entry/src/main/module.json5`中添加

```json
requestPermissions: [
  {
    name: "ohos.permission.INTERNET",
  },
],
```

## 使用示例

下面的代码展示了这个库的基本使用场景：

> [!WARNING] 使用时 import 的库名不变（仍为安装的三方包名 `@react-native-ohos/react-native-update`）。

```tsx
import { Pushy, PushyProvider, useUpdate } from '@react-native-ohos/react-native-update';

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

## 接口说明

> [!TIP] "Platform"列表示该属性在原三方库上支持的平台。

> [!TIP] "OpenHarmony Support"列为 yes 表示 OpenHarmony平台支持 该属性；no 则表示不支持；partially 表示部分支持。使用方法跨平台一致，效果对标 iOS 或 Android 的效果。

TurboModule 通道名 `Pushy`（与 JS Spec `TurboModuleRegistry.get('Pushy')` 一致），原生端全部 19 个方法均已在鸿蒙侧实现。

### API
| 名称     | 类型     | 参数类型 | 返回值 | 必填    | 平台 | OpenHarmony平台支持 | 描述  |
|--------|---------|-----|-------|-------|--------|-----|-----------------|
| getConstants | function | /  | Object   | No     | All | Yes   | 读取原生常量集（downloadRootDir/packageVersion/currentVersion 等 11 项） |
| setLocalHashInfo | function | hash, info（JSON 字符串）  | Promise\<void\>   | No     | All | Yes   | 写入指定 hash 的安装记录。 |
| getLocalHashInfo | function | hash  | Promise\<string\>（无记录返回空串）   | No     | All | Yes   | 读取指定 hash 的安装记录。 |
| setUuid | function | uuid  | Promise\<void\>   | No     | All | Yes   | 持久化灰度统计 uuid。 |
| syncNativeConfig | function | config（JSON 字符串）  | Promise\<void\>   | No     | All | Yes   | 持久化原生冷启动检查配置。 |
| markJsCheckCompleted | function | config（JSON 字符串）  | Promise\<void\>   | No     | All | Yes   | 标记本轮 JS 检查已完成。 |
| getNativeCheckCache | function | /  | Promise\<string\>（缺省空串）   | No     | All | Yes   | 读取原生冷启动检查缓存。 |
| reloadUpdate | function | {hash}  | Promise\<void\>   | No     | All | Yes   | 切换到指定 hash 并立即重启。 |
| restartApp | function | /  | Promise\<void\>   | No     | All | Yes   | 重启应用。 |
| setNeedUpdate | function | {hash}  | Promise\<void\>   | No     | All | Yes   | 标记下次启动使用指定 hash。 |
| markSuccess | function | /  | Promise\<void\>   | No     | All | Yes   | 标记当前版本运行成功。 |
| getBundleHash | function | /  | Promise\<string\>（未知返回空串）   | No     | All | Yes   | 内置 JS bundle 的 sha256。 |
| resetToPackagedBundle | function | /  | Promise\<void\>   | No     | All | Yes   | 清空更新目录并回退内置 bundle。 |
| downloadPatchFromPpk | function | {updateUrl, hash, originHash}  | Promise\<void\>   | No     | All | Yes   | 下载 ppk 差分包并合并。 |
| downloadPatchFromPackage | function | {updateUrl, hash}  | Promise\<void\>   | No     | All | Yes   | 基于内置 rawfile 包生成差分。 |
| downloadFullUpdate | function | {updateUrl, hash}  | Promise\<void\>   | No     | All | Yes   | 全量 ppk 下载解压。 |
| downloadAndInstallApk | function | {url, target, hash}  | Promise\<void\>   | No     | Android | No   | 下载并安装 APK 整包。鸿蒙端调用将 reject `UNSUPPORTED_PLATFORM`（与 iOS 行为一致）。 |
| addListener | function | eventName  | void   | No     | All | Yes   | 订阅原生事件（`RCTPushyDownloadProgress` 下载进度）。 |
| removeListeners | function | count  | void   | No     | All | Yes   | 取消事件订阅。 |

## 遗留问题

无

## 其他

无

## 目录结构
````
/react-native-update  # 项目根目录
├── harmony              # 鸿蒙适配代码
│    └─ rnoh_update.har     # har包
│    └─ update              # 鸿蒙适配核心代码
│          └─ index.ets    # 鸿蒙适配代码入口
│          └─ src/main/cpp   # C++ 侧：TurboModule（UpdatePackage.h）+ 差分引擎（HDiffPatch/LZMA）
│          └─ src/main/ets   # ETS 侧：PushyTurboModule / PushyPackage / PushyFileJSBundleProvider
├── src                  # RN代码
│    └─ index.ts         # 入口文件
│    └─ client.ts        # Pushy 客户端
│    └─ core.ts          # 更新核心流程
│    └─ provider.tsx     # PushyProvider / useUpdate
│    └─ specs            # TurboModule Spec（NativePushy）
├── example              # 示例工程（RN + HarmonyOS）
├── README.md           # 中文安装使用方法
└── README_en.md        # 英文安装使用方法
````

## 贡献代码

使用过程中发现任何问题都可以提交 [Issue](https://github.com/react-native-oh-library/react-native-update/issues)，当然，也非常欢迎提交 [PR](https://github.com/react-native-oh-library/react-native-update/pulls)。

## 开源协议

本项目基于 [MIT License](https://github.com/reactnativecn/react-native-update/blob/master/LICENSE) ，请自由地享受和参与开源。
