# 鸿蒙 Release → Pushy → 回滚自动化

入口：`example/scripts/pushy-flow.cjs`。在 `example` 目录通过 `npm.cmd run pushy:flow -- ...` 调用。

脚本执行本工程完整流程：生产 JS、Release APP/HAP 构建、对应资源校验、HAP 安装、原生基准上传、正常热更 A 发布及 100% 绑定、设备验证、未绑定测试 B 发布和自动回滚验证。所有版本标识从本轮构建与服务端读取，不沿用历史 `101080/305823/305847`。

## 快速执行

先核对 [配置文件](../../pushy-flow.config.json)，特别是设备、DevEco 路径、应用 ID 和 `runId`。

```powershell
Set-Location F:\84_Test\update84\example

# 默认只打印执行计划，不构建、不操作设备、不访问服务器。
npm.cmd run pushy:flow -- --stage all

# 执行整个流程；会构建、覆盖安装测试应用、上传版本、绑定正常 A 并操作设备。
npm.cmd run pushy:flow -- --stage all --execute
```

这不是“输出历史测试结果”的脚本。实际执行会生成新的原生构建标识、新 A/B 包及服务端记录。A 使用 `OTA-A-<runId>` 标识，B 使用 `OTA-B-ROLLBACK-<runId>`；业务源文件 `example/src/index.tsx` 不会被修改。原生构建需要的 rawfile 与构建输出会更新。

## 首次准备

1. 已安装 Node、npm、DevEco Studio、Harmony SDK 和 HDC。
2. 已安装根工程及 example 的 JS 依赖；已在 DevEco 完成鸿蒙依赖同步。
3. `example/harmony/build-profile.json5` 已配置适用于设备的签名，产品名与配置一致。脚本不创建证书、不改签名密码。
4. `example/update.json` 已选择正确 Harmony 应用，且示例中的默认 appKey 与其一致。
5. 解锁设备并保持屏幕可操作；执行过程中不要同时手动操作。UI 自动化依赖本示例页面的 testID 和中文/英文更新取消按钮。

CLI 如未安装：

```powershell
npm.cmd run pushy:flow -- --stage setup-cli --execute
```

该命令安装全局 `react-native-update-cli@2.29.3`。已经安装匹配版本时不需要执行。

尚未登录时：

```powershell
npm.cmd run pushy:flow -- --stage login --execute
```

这是交互式登录，使用现有 CLI 凭据文件；脚本不把账号密码写入配置或报告。已有会话无需重复登录。应用尚未选定时，用现有 `npm.cmd run pushy -- selectApp --platform harmony` 完成选择；本脚本不自动创建服务端应用。

## 配置项

配置中的相对产物路径相对于 `example`。`--config` 的相对路径也相对于 `example`，不受调用终端所在目录影响。

| 字段 | 含义 |
| --- | --- |
| `runId` | 本轮唯一名称。允许字母、数字、下划线、横线；重新完整测试时换新名称 |
| `cliVersion` | 固定 `2.29.3`，内部 API 按该版本适配 |
| `appId` | 必须与 update.json 的 Harmony appId 一致 |
| `device` | HDC 设备标识 |
| `bundleName` / `ability` | 测试应用与 Ability |
| `product` | 默认 `default`，须匹配 build-profile |
| `devecoHome` | DevEco 安装目录；配置不提供时读取 `DEVECO_HOME` |
| `hdc` | `hdc` 或 hdc.exe 的绝对路径 |
| `appOutput` / `hapOutput` | assembleApp 产出的 APP 与签名 HAP 路径 |
| `serverTimeoutMs` | 等待服务端状态的最长时间 |
| `downloadTimeoutMs` | 等待设备下载完成的最长时间 |
| `env` | 可选子进程环境覆盖，如 SDK 路径；不要在此保存令牌或签名密码 |
| `cliRoot` | 可选，全局 CLI 包目录，默认从当前 node.exe 同目录下的 node_modules 定位 |
| `npmCli` | 可选，npm/bin/npm-cli.js 路径 |
| `hvigorNode` | 可选，执行 Hvigor 的 node.exe 路径，默认 DevEco 内置 Node |

脚本在未配置时尝试把 DevEco 的 `jbr`、`sdk`、`tools/ohpm` 用作子进程的 JAVA_HOME、DEVECO_SDK_HOME、OHPM_HOME，并补充工具 PATH。仅对本次子进程生效，不修改系统环境。使用独立 SDK 时在 `env` 中填写实际目录。

示例配置用于当前机器。其他机器必须调整工具路径和设备 ID。

## 阶段与断点续跑

| 阶段 | 操作 / 验收 |
| --- | --- |
| `preflight` | 只读检查 CLI、会话、应用配置、签名是否配置、设备连通性；保存本地状态 |
| `baseline` | `npm run prod`，随后只执行一次 Release assembleApp；归档 APP/HAP，比较版本、buildTime、bundleHash 和所有 rawfile 内容 |
| `install` | 安装归档 HAP，冷启动，核对实际 packageVersion/buildTime；记录当前 hash，不清除应用数据 |
| `upload` | 按版本和 buildTime 查询；未登记才上传 APP，等待状态 normal |
| `normal-build` | 独立副本生成正常 A，自动确认成功，关闭 JS 自动检查与自动更新策略；生产打包并保留 sourcemap |
| `normal-publish` | 上传 A，核对服务器 CDN 文件与本地 PPK 的 SHA-256 |
| `bind` | 把 A 以 100% 绑定本轮原生包，核验 full 绑定 |
| `normal-verify` | 下载、切换 A，明确标记 A 成功并冷启动确认 |
| `rollback-build` | 独立副本生成 B，`autoMarkSuccess=false`，保留正常业务源码 |
| `rollback-publish` | 上传 B，始终不提供绑定参数；检查全部原生包绑定中没有 B |
| `rollback-test` | 重新确保 A 正常，下载并运行 B，不 markSuccess，强停后冷启动；验证新进程日志、当前 hash 和绑定状态 |

按阶段执行示例：

```powershell
npm.cmd run pushy:flow -- --stage preflight --execute
npm.cmd run pushy:flow -- --stage baseline --execute
npm.cmd run pushy:flow -- --stage install --execute
npm.cmd run pushy:flow -- --stage upload --execute

# 从已有完成状态继续剩余阶段
npm.cmd run pushy:flow -- --stage all --execute
```

状态文件位于 `artifacts/pushy-flow/<runId>/state.json`。成功阶段会跳过；失败阶段记录错误，不记为完成。重跑相同命令会从未完成阶段继续。

注意：

- `all` 的再次执行是**续跑**，不是重新执行已经成功的设备测试。需要全新完整验证时修改 `runId`。
- 不允许在同一 runId 下修改配置；业务源码在构建 A/B 前也会校验是否变化。变化时用新 runId。
- 完成阶段的归档文件摘要发生变化会停止，不使用被覆盖的包继续上传。
- 上传成功但进程在写回执前退出时，下次先查询同名版本，并通过 CDN 校验确认是否能复用，避免盲目重发。
- `running.lock` 防止同一 runId 并发执行。异常断电可能留下锁；确认锁内 PID 对应的旧脚本已结束后，再仅删除该锁文件。不要并发操作同一设备，即使 runId 不同。
- 失败的设备回滚测试会尝试恢复正常 A，恢复成功也不会把测试改为 PASS；恢复失败会记录原因并保留证据。
- 服务端发布或绑定已完成后，后续失败不会自动删除版本或恢复旧绑定；请根据回执判断所处阶段。

## 输出与判定

```text
artifacts/pushy-flow/<runId>/
  state.json
  baseline/                  # 同一构建的 APP、签名 HAP
  baseline-info.json
  native-registration.json
  normal/                    # fixture.tsx、PPK、bundle、sourcemap
  normal-published.json
  normal-binding.json
  rollback/                  # autoMarkSuccess=false 测试产物
  rollback-published.json
  normal-<时间戳>/            # UI 布局与截图
  rollback-<时间戳>/          # 连续日志、新进程日志、前后绑定与截图
  verification.json           # 最终 PASS 或设备测试失败详情
```

设备测试阶段必须同时满足：

1. 实际进入 B，当前 hash 与服务端 B 一致。
2. 结束进程后产生新进程，并恢复 A 的当前 hash。
3. 新进程日志包含 `Version <B> was not marked as successful, rolled back to <A>`。
4. B 未绑定，测试前后正常包绑定一致。

页面恢复 A 但没有明确原生日志时，脚本失败并保留证据，不判 PASS。此脚本验证首次启动未确认成功，不注入 JS/原生崩溃。

## 已做的验证与限制

开发时已完成：

- Node 语法检查和 7 项测试（fixture 条件、源码锚点漂移、hash 识别、PID/回滚原因、APP/HAP 身份、未绑定保护、目录边界、默认预览无副作用，其中部分合并在同一用例）。
- 本机 `preflight` 实际通过，确认现有 CLI、SDK、签名配置引用、设备连通性和 Pushy 登录可读取。
- 用已归档 APP/HAP 验证 CLI 解析接口，版本、buildTime、bundleHash 和 3 项 rawfile 内容一致。
- 默认 `all` 计划预览通过。

**这套新脚本尚未端到端执行新的构建、上传、发布和真机回滚。** 历史回滚成功记录属于之前的脚本与产物，不能作为新编排脚本全流程通过的证明。实际执行可能仍受 SDK、签名有效性、服务端处理时间、设备弹窗和页面变化影响；出现问题会停在对应阶段并保留状态。

设备 UI 使用屏幕布局计算滑动范围，并在填写后回读校验参数。它会取消已识别的 SDK 下载提示，但不会自动接受系统授权、处理锁屏或替用户配置签名。

运行测试：

```powershell
npm.cmd run test:pushy-flow
```

详细业务流程见 [全流程报告](../../../react-native-update鸿蒙Release基准与热更新回滚全流程报告.md)。
