// 流水线脚手架类名（ohos/package.json harmony.autolinking.etsPackageClassName = UpdatePackage）
// 与上游 PushyPackage 统一为同一实现：autolink 注册 UpdatePackage 即注册上游 PushyPackage，
// 避免两个等价 RNOHPackage 子类（均注册 'Pushy' TurboModule 工厂）造成重复注册与静态门禁误报。
export { PushyPackage as UpdatePackage } from './PushyPackage';
export { PushyPackage as default } from './PushyPackage';
