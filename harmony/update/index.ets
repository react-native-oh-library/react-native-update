// 流水线默认导出（ohos/package.json harmony.autolinking.etsPackageClassName = UpdatePackage）
// UpdatePackage 即上游 PushyPackage 的别名（同一实现类，autolink 注册一次即可），
// 对齐上游 harmony/pushy/index.ets 的导出面（Example 侧 RNPackagesFactory / jsBundleProvider 使用）
export { PushyPackage as default } from './src/main/ets/PushyPackage';
export { PushyPackage as UpdatePackage } from './src/main/ets/PushyPackage';
export { PushyPackage } from './src/main/ets/PushyPackage';
export { PushyTurboModule } from './src/main/ets/PushyTurboModule';
export { PushyFileJSBundleProvider } from './src/main/ets/PushyFileJSBundleProvider';
