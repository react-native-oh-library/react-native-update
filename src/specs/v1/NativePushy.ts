import { type TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /**
   * 读取原生常量集，包括下载目录、安装包版本、当前热更新版本等信息。
   *
   * @returns 原生常量对象。
   */
  getConstants: () => {
    downloadRootDir: string;
    packageVersion: string;
    currentVersion: string;
    isFirstTime: boolean;
    rolledBackVersion: string;
    buildTime: string;
    uuid: string;
    isUsingBundleUrl: boolean;
    currentVersionInfo: string;
    supportedDiffVersion: number;
    /**
     * 安装记录（cpp/patch_core/install_record.h）中保存的当前运行热更新包的 SHA-256。
     * 使用内置包、旧版安装记录或旧版原生模块时为空字符串。
     */
    currentBundleSha256?: string;
  };
  /**
   * 写入指定 hash 的安装记录。
   *
   * @param hash - 热更新版本的 hash。
   * @param info - 安装记录的 JSON 字符串。
   * @returns 安装记录写入完成时兑现的 Promise。
   */
  setLocalHashInfo(hash: string, info: string): Promise<void>;
  /**
   * 读取指定 hash 的安装记录。
   *
   * @param hash - 热更新版本的 hash。
   * @returns 安装记录的 JSON 字符串；无记录时返回空字符串。
   */
  getLocalHashInfo(hash: string): Promise<string>;
  /**
   * 持久化用于灰度统计的 UUID。
   *
   * @param uuid - 用于标识当前安装实例的 UUID。
   * @returns UUID 持久化完成时兑现的 Promise。
   */
  setUuid(uuid: string): Promise<void>;
  /**
   * 持久化原生冷启动更新检查所需的配置子集，包括 appKey、服务端地址和 afterDownload 策略
   * （参见 NATIVE_CHECKUPDATE_DESIGN §10.1）。配置以原始 JSON 字符串存储，读取时由原生侧解析。
   * JS 是唯一的配置来源；原生侧未持久化配置时会静默跳过检查，此行为也用于控制该功能的启用范围。
   *
   * @param config - 原生冷启动更新检查所需配置的 JSON 字符串。
   * @returns 配置持久化完成时兑现的 Promise。
   */
  syncNativeConfig(config: string): Promise<void>;
  /**
   * 读取原生冷启动更新检查缓存的原始响应，包括用于限定复用范围的请求和配置指纹（参见 §10.3）。
   *
   * @returns 缓存的原始响应字符串；无缓存时返回空字符串，Promise 不会被拒绝。
   */
  getNativeCheckCache(): Promise<string>;
  /**
   * 标记 JS 已在当前进程中获取指定配置的有效更新检查响应。
   * 若持久化配置匹配，延迟执行的冷启动检查会跳过自身请求；崩溃救援检查不受影响（参见 §10.3）。
   * 旧版原生模块不提供此方法。
   *
   * @param config - 本次 JS 检查使用的配置 JSON 字符串，与 syncNativeConfig 持久化的格式相同。
   * @returns 完成标记处理后兑现的 Promise。
   */
  markJsCheckCompleted(config: string): Promise<void>;
  /**
   * 切换到指定 hash 的热更新版本并立即重启。
   *
   * @param options - 切换选项，hash 为目标热更新版本的 hash。
   * @returns 切换及重启请求处理完成时兑现的 Promise。
   */
  reloadUpdate(options: { hash: string }): Promise<void>;
  /**
   * 重启应用。
   *
   * @returns 重启请求处理完成时兑现的 Promise。
   */
  restartApp(): Promise<void>;
  /**
   * 标记下次启动使用指定 hash 的热更新版本。
   *
   * @param options - 更新选项，hash 为下次启动使用的热更新版本的 hash。
   * @returns 更新标记保存完成时兑现的 Promise。
   */
  setNeedUpdate(options: { hash: string }): Promise<void>;
  /**
   * 标记当前版本运行成功。
   *
   * @returns 成功标记保存完成时兑现的 Promise。
   */
  markSuccess(): Promise<void>;
  /**
   * 获取安装包内置 JS 包（pdiff 差分源）的 SHA-256，由原生侧按需计算并缓存。
   *
   * @returns 内置 JS 包的 SHA-256；无法获取时（调试构建、无内置包或计算失败）返回空字符串，
   * Promise 不会被拒绝。
   */
  getBundleHash(): Promise<string>;
  /**
   * 清理热更新目录并将后续启动恢复为内置 bundle。
   *
   * @returns 回退状态保存完成时兑现的 Promise。
   */
  resetToPackagedBundle(): Promise<void>;
  /**
   * 下载 PPK 差分包并与已有热更新包合并，生成目标版本。
   *
   * @param options - 下载选项：updateUrl 为差分包地址，hash 为目标版本的 hash，
   * originHash 为用于合并的原热更新版本的 hash。
   * @returns 差分包下载并合并完成时兑现的 Promise。
   */
  downloadPatchFromPpk(options: {
    updateUrl: string;
    hash: string;
    originHash: string;
  }): Promise<void>;
  /**
   * 下载基于内置包的差分包并合并，生成目标版本；鸿蒙侧基于内置 rawfile 包。
   *
   * @param options - 下载选项：updateUrl 为差分包地址，hash 为目标版本的 hash。
   * @returns 差分包下载并合并完成时兑现的 Promise。
   */
  downloadPatchFromPackage(options: {
    updateUrl: string;
    hash: string;
  }): Promise<void>;
  /**
   * 下载并解压全量 PPK 热更新包。
   *
   * @param options - 下载选项：updateUrl 为全量包地址，hash 为目标版本的 hash。
   * @returns 全量包下载并解压完成时兑现的 Promise。
   */
  downloadFullUpdate(options: {
    updateUrl: string;
    hash: string;
  }): Promise<void>;
  /**
   * 下载并安装 APK 整包，仅支持 Android。
   *
   * @remarks
   * OpenHarmony 不支持 APK 安装，调用时 Promise 以 UNSUPPORTED_PLATFORM 错误拒绝。
   *
   * @param options - 安装选项：url 为 APK 下载地址，target 为保存路径，hash 为目标包的 hash。
   * @returns APK 下载完成并请求安装时兑现的 Promise。
   */
  downloadAndInstallApk(options: {
    url: string;
    target: string;
    hash: string;
  }): Promise<void>;
  /**
   * 订阅原生事件，供 NativeEventEmitter 管理监听器。
   *
   * @param eventName - 事件名称，下载进度事件为 RCTPushyDownloadProgress。
   * @returns 无返回值。
   */
  addListener(eventName: string): void;
  /**
   * 取消原生事件订阅，供 NativeEventEmitter 管理监听器。
   *
   * @param count - 要移除的监听器数量。
   * @returns 无返回值。
   */
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.get<Spec>('Pushy') as Spec | null;
