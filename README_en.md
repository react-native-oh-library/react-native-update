> Document Template: v0.4.2

<p align="center">
  <h1 align="center"> <code>react-native-update</code> </h1>
</p>

This project is developed based on [react-native-update](https://github.com/reactnativecn/react-native-update).

The version mapping is as follows:

| Library Name | Library Version (npm) | Release Info | Supported RN Version | Autolink | Compilation API Version | Community Baseline Version | Source Code |
| ------------ | ------------ | ------------------------------ | ------------- | ------------- |------------------------ | ------------- | ------------- | 
| @react-native-ohos/react-native-update | [10.56.1](https://www.npmjs.com/package/@react-native-ohos/react-native-update)    | [GitHub Releases](https://github.com/react-native-oh-library/react-native-update/releases) | 0.72.\*/0.77.\*/0.82.\*/0.84.\* | Yes | API12+ | 10.56.1 | [master](https://github.com/react-native-oh-library/react-native-update/tree/master) |

## Introduction

react-native-update is the official client library of the [Pushy hot-update service](https://pushy.reactnative.cn/), providing JS bundle hot-update capability for React Native applications.<br/>
This library is its OpenHarmony (HarmonyOS) adapted version. Main capabilities include:

- Full ppk update: download, decompress, switch, and roll back;
- Differential pdiff update: HDiffPatch + LZMA patch merging, sharing the same C++ implementation with the Android side;
- Version management and gray release: markSuccess success marking, hash installation records, gray-release uuid, native cold-start check cache, etc.

## Installation

Navigate to your project directory and run the following command:

**npm**

```bash
npm install @react-native-ohos/react-native-update
```

**yarn**

```bash
yarn add @react-native-ohos/react-native-update
```

## Link

|                                      | Autolink Supported | RN Framework Version |
|--------------------------------------|----------------|-----------|
| 10.56.1                              | Yes            |  0.72/0.77/0.82/0.84     |

Projects using AutoLink need to be configured according to this document. Autolinking framework guide: https://gitcode.com/CPF-RN/ohos_react_native/blob/master/docs/zh-cn/Autolinking.md

If the version you are using supports Autolink and your project has integrated Autolink, you can skip the ManualLink configuration.

<details>
  <summary>ManualLink: Guide for manually configuring native dependencies</summary>

First, open the `harmony` HarmonyOS project of your project in DevEco Studio.

### 1. Overrides RN SDK

To make the project depend on the same version of the RN SDK, you need to add the `overrides` field in the `oh-package.json5` in the project root directory, pointing to the RN SDK version that the project needs to use. The substituted version can be a specific version number, a fuzzy version, or a local HAR package or source directory.

For the role of this field, please read the [official documentation](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/ide-oh-package-json5-V5#zh-cn_topic_0000001792256137_overrides)

```json
{
  "overrides": {
    "@rnoh/react-native-openharmony": "file:../node_modules/@react-native-oh/react-native-harmony/react_native_openharmony.har" // online ohpm version
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony.har" // path to a local har package
    // "@rnoh/react-native-openharmony" : "./react_native_openharmony" // path to source code
  }
}
```

### 2. Add the Native Code

There are currently two methods:

- Import via a har package;
- Link the source code directly.

Method 1: Import via a har package (recommended)

> [!TIP] The har package is located in the `harmony` folder of the third-party library installation path.

Open `entry/oh-package.json5` and add the following dependency

```json
"dependencies": {
    "@react-native-ohos/react-native-update": "file:../../node_modules/@react-native-ohos/react-native-update/harmony/rnoh_update.har"
}
```

Click the `sync` button in the upper right corner

Or run in the command-line terminal:

```bash
cd entry
ohpm install
```

Method 2: Link the source code directly

> [!TIP] To link the source code directly, please refer to the [link-source-code instructions](https://gitcode.com/CPF-RN/usage-docs/blob/master/zh-cn/link-source-code.md)

### 3. Configure CMakeLists and Import UpdatePackage

Open `entry/src/main/cpp/CMakeLists.txt` and add:

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

Open `entry/src/main/cpp/PackageProvider.cpp` and add:

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

### 4. Import UpdatePackage on the ArkTS Side

Open `entry/src/main/ets/RNPackagesFactory.ts` and add:

```diff
  ...
+ import { UpdatePackage } from '@react-native-ohos/react-native-update/ts';

export function createRNPackages(ctx: RNPackageContext): RNPackage[] {
  return [
+    new UpdatePackage(ctx)
  ];
}
```

### 5. Configure the Hot-Update Bundle Fallback Chain (Required to Enable Hot Update)

This library loads the new bundle from the hot-update directory through `PushyFileJSBundleProvider`. Open `entry/src/main/ets/pages/Index.ets` (or `entry/src/main/ets/rn/LoadBundle.ets`), and insert it after `MetroJSBundleProvider` in the `AnyJSBundleProvider` chain:

```diff
+ import { PushyFileJSBundleProvider } from '@react-native-ohos/react-native-update';

jsBundleProvider: new TraceJSBundleProviderDecorator(
  new AnyJSBundleProvider([
    new MetroJSBundleProvider(),
+   new PushyFileJSBundleProvider(this.rnohCoreContext.uiAbilityContext), // hot-update bundle
    new ResourceJSBundleProvider(this.rnohCoreContext.uiAbilityContext.resourceManager, 'bundle.harmony.js'),
  ]),
  this.rnohCoreContext.logger),
```
</details>

### Run

Click the `sync` button in the upper right corner

Or run in the command-line terminal:

```bash
cd entry
ohpm install
```

Then compile and run the project.

## Constraints and Limitations

### Compatibility

The content of this document has been verified with the following versions:

1.RNOH: 0.84.2; SDK: HarmonyOS 6.0.1 Release SDK; IDE: DevEco Studio 6.0.1.260; ROM:6.0.0.130;
2.RNOH: 0.82.22; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.878; ROM: 6.0.0.130;
3.RNOH: 0.77.18; SDK: HarmonyOS 6.0.0 Release SDK; IDE: DevEco Studio 6.0.0.858; ROM: 6.0.0.112;
4.RNOH: 0.72.33; SDK: HarmonyOS NEXT B1; IDE: DevEco Studio: 5.0.3.900; ROM: Next.0.0.71;

### Permission Requirements

- Hot-update packages are downloaded via network urls, so the application needs to apply for the network permission (normal level, no user authorization required). It is declared by the host application in the entry module (the HAR itself does not declare it)

  Add the following to `entry/src/main/module.json5`:

```json
requestPermissions: [
  {
    name: "ohos.permission.INTERNET",
  },
],
```

## Usage Example

The following code demonstrates the basic usage scenario of this library:

> [!WARNING] The library name in the import statement remains unchanged (still the installed package name `@react-native-ohos/react-native-update`).

```tsx
import { Pushy, PushyProvider, useUpdate } from '@react-native-ohos/react-native-update';

// 1. Wrap the app entry with the Provider (auto check for updates + download progress + automatic markSuccess)
const client = new Pushy({ appKey: 'your appKey' });

function App() {
  return (
    <PushyProvider client={client}>
      <Router />
    </PushyProvider>
  );
}

// 2. Consume the update state in a page
function UpdateBanner() {
  const { update, progress, checkUpdate, switchVersion, switchVersionLater } = useUpdate();
  if (!update) {
    return null;
  }
  return (
    <View>
      <Text>New version found: {update.name}</Text>
      <Button title="Update Now" onPress={() => switchVersion(update.hash)} />
      <Button title="Apply on Next Launch" onPress={() => switchVersionLater(update.hash)} />
      <Text>Download progress: {progress.received}/{progress.total}</Text>
    </View>
  );
}
```

## API Description

> [!TIP] The "Platform" column indicates the platforms supported by the property in the original third-party library.

> [!TIP] "yes" in the "OpenHarmony Support" column means the property is supported on the OpenHarmony platform; "no" means not supported; "partially" means partially supported. The usage is consistent across platforms, and the effect is benchmarked against iOS or Android.

The TurboModule channel name is `Pushy` (consistent with the JS Spec `TurboModuleRegistry.get('Pushy')`), and all 19 native methods have been implemented on the HarmonyOS side.

### API
| Name     | Type     | Param Type | Return Value | Required    | Platform | OpenHarmony Support | Description  |
|--------|---------|-----|-------|-------|--------|-----|-----------------|
| getConstants | function | /  | Object   | No     | All | Yes   | Reads the native constant set (downloadRootDir/packageVersion/currentVersion, etc., 11 items in total) |
| setLocalHashInfo | function | hash, info (JSON string)  | Promise\<void\>   | No     | All | Yes   | Writes the installation record of the specified hash. |
| getLocalHashInfo | function | hash  | Promise\<string\>   | No     | All | Yes   | Reads the installation record of the specified hash. |
| setUuid | function | uuid  | Promise\<void\>   | No     | All | Yes   | Persists the gray-release statistics uuid. |
| syncNativeConfig | function | config (JSON string)  | Promise\<void\>   | No     | All | Yes   | Persists the native cold-start check configuration. |
| markJsCheckCompleted | function | config (JSON string)  | Promise\<void\>   | No     | All | Yes   | Marks the JS check of the current round as completed. |
| getNativeCheckCache | function | /  | Promise\<string\>    | No     | All | Yes   | Reads the native cold-start check cache. |
| reloadUpdate | function | {hash}  | Promise\<void\>   | No     | All | Yes   | Switches to the specified hash and restarts immediately. |
| restartApp | function | /  | Promise\<void\>   | No     | All | Yes   | Restarts the application. |
| setNeedUpdate | function | {hash}  | Promise\<void\>   | No     | All | Yes   | Marks the next launch to use the specified hash. |
| markSuccess | function | /  | Promise\<void\>   | No     | All | Yes   | Marks the current version as running successfully. |
| getBundleHash | function | /  | Promise\<string\>   | No     | All | Yes   | Returns the sha256 of the built-in JS bundle. |
| resetToPackagedBundle | function | /  | Promise\<void\>   | No     | All | Yes   | Clears the update directory and rolls back to the built-in bundle. |
| downloadPatchFromPpk | function | {updateUrl, hash, originHash}  | Promise\<void\>   | No     | All | Yes   | Downloads the ppk differential package and merges it. |
| downloadPatchFromPackage | function | {updateUrl, hash}  | Promise\<void\>   | No     | All | Yes   | Generates a differential patch based on the built-in rawfile package. |
| downloadFullUpdate | function | {updateUrl, hash}  | Promise\<void\>   | No     | All | Yes   | Downloads and decompresses a full ppk package. |
| downloadAndInstallApk | function | {url, target, hash}  | Promise\<void\>   | No     | Android | No   | Downloads and installs a full APK package.  |
| addListener | function | eventName  | void   | No     | All | Yes   | Subscribes to native events (`RCTPushyDownloadProgress` download progress). |
| removeListeners | function | count  | void   | No     | All | Yes   | Unsubscribes from events. |

## Known Issues

None

## Others

None

## Directory Structure
````
/react-native-update  # Project root directory
├── harmony              # HarmonyOS adaptation code
│    └─ rnoh_update.har     # har package
│    └─ update              # Core HarmonyOS adaptation code
│          └─ index.ets    # Entry of the HarmonyOS adaptation code
│          └─ src/main/cpp   # C++ side: TurboModule (UpdatePackage.h) + diff engine (HDiffPatch/LZMA)
│          └─ src/main/ets   # ETS side: PushyTurboModule / PushyPackage / PushyFileJSBundleProvider
├── src                  # RN code
│    └─ index.ts         # Entry file
│    └─ client.ts        # Pushy client
│    └─ core.ts          # Core update flow
│    └─ provider.tsx     # PushyProvider / useUpdate
│    └─ specs            # TurboModule Spec (NativePushy)
├── example              # Example project (RN + HarmonyOS)
├── README.md           # Chinese installation and usage guide
└── README_en.md        # English installation and usage guide
````

## Contributing

If you encounter any problems during use, feel free to submit an [Issue](https://github.com/react-native-oh-library/react-native-update/issues). Pull requests are also highly welcome via [PR](https://github.com/react-native-oh-library/react-native-update/pulls).

## License

This project is based on the [MIT License](https://github.com/reactnativecn/react-native-update/blob/master/LICENSE). Feel free to enjoy and contribute to open source.
