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
     * SHA-256 of the running hot-update bundle as recorded by the install
     * (cpp/patch_core/install_record.h); '' for the embedded bundle, legacy
     * installs, or older native modules.
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
   * Persist the config subset the native cold-start update check consumes
   * (appKey, endpoints, afterDownload policy; NATIVE_CHECKUPDATE_DESIGN
   * §10.1). Stored as a raw JSON string, parsed natively on read. JS is the
   * single config source — a native side without persisted config silently
   * skips its check, which doubles as the feature's rollout gate.
   */
  syncNativeConfig(config: string): Promise<void>;
  /**
   * Raw response cached by the native cold-start check, including the request
   * and config fingerprints that scope reuse (§10.3). Resolves to
   * an empty string when absent; never rejects.
   */
  getNativeCheckCache(): Promise<string>;
  /**
   * JS obtained a valid check response in this process for `config` (the
   * same JSON syncNativeConfig persists). The delayed cold-start round skips
   * its own request when its persisted config matches; a crash-rescue round
   * is unaffected (§10.3). Older native modules lack this method.
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
   * sha256 of the JS bundle embedded in the binary (the pdiff source), lazily
   * computed and cached natively. Resolves to an empty string when unknown
   * (debug build, no embedded bundle, hash failure) — never rejects.
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
