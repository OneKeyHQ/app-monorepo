# Pro 2 Protocol、Settings 与 Firmware 接入设计

## 目标

以 `firmware-pro2` 的最新 `dev` protobuf 为唯一协议源，使 `hardware-js-sdk` 与 App 对 Pro 2 的 onboarding、设备状态、Settings 和 firmware 更新能力保持一致，并提供可重复执行的自动化验证。

## 协议源与依赖边界

- 固件协议源：`firmware-pro2 origin/dev`，当前目标提交为 `e4884ae8`。
- SDK 开发主线：`hardware-js-sdk feat/pro2-usb-ble`。该仓库没有远端 `dev` 分支，其 `submodules/firmware-pro2` 已指向 `e4884ae8`。
- App 当前依赖：`@onekeyfe/hd-* 1.2.0-alpha.16`。已发布的 alpha.16 仍包含旧 onboarding stage 协议，不能直接解码最新固件响应。
- 不在本任务中发布 npm 包。App 使用按仓库 patch-package 流程生成的临时 SDK 协议补丁，内容必须来自同一份 `hardware-js-sdk` 生成产物；新版 SDK 发布后删除补丁并升级版本。

## Onboarding

SDK 暴露生成类型 `DevOnboardingStatus`、`DevOnboardingStep`、`DevOnboardingPhase`、`DevOnboardingSetupKind` 和 `DevOnboardingSetupMethod`。App 不再维护平行的手写传输类型，也不再使用强制类型断言。

页面按 `step` 决定宏观步骤，按 `phase` 与 `setup` 决定当前说明内容。完成条件保持为 `step=DONE && pin_set && wallet_initialized`。所有枚举值、数字 protobuf 值、未知值、接口失败和断连重试都需要测试。SeedCard backup phases 必须映射到已有 backup/setup 展示，而不能退回无限 Checking。

## Device Status 与 Settings

后台提供一个 Pro 2 快照读取入口：

1. `DeviceStatusGet` 始终可读，用于连接、初始化、锁定、备份、passphrase 和 attach-to-PIN 状态。
2. `DeviceInfoGet` 读取硬件、主 MCU、协处理器及 SE1-SE4 信息，并缓存连接生命周期内的静态数据。
3. `DeviceSettingsGet` 仅在设备解锁后读取；锁定时保留明确的“设置不可访问”状态。

Settings 操作统一走 Protocol V2：

- `DeviceSettingsSet`：label、Bluetooth、language、brightness、auto lock、auto shutdown、animation、tap-to-wake、haptic、device-name display、FIDO、experimental、USB lock、random keypad，以及固件允许直接设置的字段。
- `DeviceSettingsPageShow`：reset、PIN change、passphrase、air-gap。
- `DeviceUploadWallpaper`：604×1024 RGBA 编码、上传并设置 wallpaper path。

现有 App UI 先接通已有产品入口：设备名称、语言、亮度、自动锁定、自动关机、触觉反馈、壁纸、修改 PIN、passphrase 和擦除。其他固件字段通过精确类型的后台通用方法可调用，不在本任务中新增未经产品定义的设置页面。

## Firmware Pro 2

固件线上的可安装目标为 bootloader、application P1、application P2、coprocessor、SE01-SE04；resource 保持现有文件资源同步流程，不伪装成 protobuf firmware target。Romloader 不进入普通 `firmwareUpdateV4`，继续使用 loader 专用流程。

App 的目标发现、强制更新开发页和 SDK 参数必须包含：

- `boot`
- `app_v1`
- `app_v2`
- `coprocessor`
- `resource`
- `se01`、`se02`、`se03`、`se04`

更新状态需要覆盖 pending、in-progress、finished 与所有固件定义的失败状态。

## 跨平台运行时

- iOS、Android、浏览器扩展：硬件连接和 SDK 请求由 `bg` runtime 持有；UI 在 `main` runtime。返回值会分别存在于 bg 与 main JS 堆中，两个 runtime 独立初始化，不能假设连接与页面同时就绪。
- Desktop/Web：main 与 background 逻辑运行在单一 JS runtime，但硬件连接仍由后台服务抽象负责。
- 所有硬件调用保持在 background 层，UI 只消费序列化后的精确状态。

## 错误处理

- 保留 SDK 的设备错误与 firmware task status，不用通用“未连接”覆盖所有失败原因。
- 未知未来枚举进入可重试的 checking/unsupported 状态，并记录非敏感诊断字段。
- 设备锁定时不读取私有 Settings；需要交互的 Settings Page 由 SDK 解锁策略处理。
- 不记录设备序列号、设备 ID、钱包数据或其他敏感信息。

## 测试与验收

1. SDK protobuf 生成测试证明最新 onboarding、Settings 和 firmware 枚举存在。
2. SDK API 测试证明四个 Settings 接口与 onboarding 使用 Protocol V2 并发送正确 protobuf 消息。
3. App Mapper 测试覆盖所有 onboarding step/phase、setup kind/method、完成条件和未知值。
4. App Service 测试覆盖锁定/解锁、初始化/未初始化、需要备份、并发快照、缓存失效与 Settings 路由。
5. Firmware 测试覆盖所有受支持目标和状态。
6. 运行相关 Jest、SDK build/type check、App 定向检查；全仓检查若被无关既有错误阻断，需要明确列出。

## 非目标

- 不发布 npm 包。
- 不修改固件业务实现，只同步最新 `firmware-pro2 dev` 协议。
- 不新增缺少产品规格的 Settings UI。
- 不通过普通 firmware update 流程刷写 romloader。
