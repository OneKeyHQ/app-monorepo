# Pro2 Device Settings Adapter Design

## 背景

app-monorepo 的 `DeviceSettingsManager` 当前统一使用 Protocol V1 风格接口：

- 普通设置通过 `deviceSettings`；
- Passphrase、PIN 和 wipe 使用旧管理方法；
- Pro/Touch 彩色壁纸通过 `deviceUploadResource` 上传 JPEG 主图、缩略图和模糊图。

Pro2 使用 Protocol V2。hardware-js-sdk 已新增：

- `deviceSettingsGet`；
- `deviceSettingsSet`；
- `deviceSettingsPageShow`；
- `deviceUploadWallpaper`；
- `Failure_ProcessError / subcode 9 / Device locked` 的统一自动解锁重试。

app-monorepo 必须在 background 硬件服务层集中适配，否则现有 UI 操作会继续向 Pro2 发送旧协议消息。

## 目标

1. 在 `DeviceSettingsManager` 集中区分 Pro2 与现有设备，不在各 UI 页面散落协议判断。
2. Pro2 普通设置使用 `deviceSettingsSet`。
3. Pro2 危险设置使用 `deviceSettingsPageShow`。
4. Pro2 壁纸使用 `deviceUploadWallpaper`。
5. 保持 Protocol V1、Trezor 及第三方设备行为不变。
6. 保持硬件通信只运行在 background runtime。
7. 避免把 604×1024 RGBA 作为 background RPC 参数从 main runtime 传输。

## Runtime 边界

### main runtime

- 负责图片选择、预览和现有的设备尺寸裁剪流程。
- 继续通过 `deviceHomeScreenUtils.buildCustomScreenHex` 生成已裁剪的 JPEG `screenHex`。
- 不调用 hardware SDK，不直接进行设备通信。

### background runtime

- `DeviceSettingsManager` 拥有协议选择和所有 hardware SDK 调用。
- 对 Pro2，将压缩 JPEG 字节解码为 604×1024 RGBA，再调用 `deviceUploadWallpaper`。
- hardware SDK、transport、USB/BLE 连接和自动解锁状态均只存在于 background JS heap。

### Native 资源与 JS heap

- main 与 background 的 JS heap 相互隔离；图片参数通过 background RPC 序列化传递。
- 原始 RGBA 大小为 `604 * 1024 * 4 = 2,473,984` 字节，跨 runtime 传输会产生至少一份额外 JS heap 副本。
- 现有 JPEG `screenHex` 已经通过相同 RPC 传输，因此继续复用该压缩载荷，不新增 RGBA RPC 字段。
- USB/BLE native transport 资源由 background 硬件服务持有；main runtime 不共享 SDK JS 对象。

## 图片处理方案

### 方案 A：main 生成 RGBA 并传给 background

优点是 background 不需要图片解码器。缺点是单张图片约 2.47 MB；若编码为 hex 则约 4.95 MB，增加 RPC 序列化、main/bg JS heap 和移动端内存压力。

### 方案 B：background 从 URI 重新读取和裁剪

避免 RGBA RPC，但 background runtime 无法稳定复用 main runtime 的 DOM、Canvas 或 Expo ImageManipulator 上下文；不同平台 URI 权限和生命周期也不一致。

### 方案 C：main 继续输出 JPEG，background 纯 JS 解码为 RGBA（采用）

沿用现有 `screenHex` 数据合同。main 使用已有跨平台图片流程把任意用户图片裁剪并转为 JPEG；background 使用直接依赖的 `jpeg-js` 解码 RGB/RGBA，校验尺寸后调用 SDK。该方案不改变 RPC 参数规模，且保持硬件通信隔离。

App 的 Pro2 壁纸入口因此支持现有图片选择器能够读取的格式，但在 main → background 边界统一归一化为 JPEG。透明通道在 App 正式壁纸流程中会被 JPEG 扁平化；Playground 仍可直接测试 SDK 的 RGB565A8 透明图片能力。

## Pro2 判定

在 `DeviceSettingsManager` 增加单一私有 helper，基于 `IDBDevice.deviceType === EDeviceType.Pro2` 判断。不得根据设备名称、固件版本或 connectId 猜测。

所有分支保持顺序：

1. Trezor/第三方现有分支；
2. OneKey Pro2 Protocol V2 分支；
3. OneKey Protocol V1 原有分支。

## 设置映射

| App 操作 | Pro2 SDK 调用 | Protocol V1 行为 |
| --- | --- | --- |
| 设置 label | `deviceSettingsSet({settings:{label}})` | 保持 `deviceSettings({label})` |
| 自动锁定 | `deviceSettingsSet({settings:{autolock_delay_ms}})` | 保持 `deviceSettings({autoLockDelayMs})` |
| 自动关机 | `deviceSettingsSet({settings:{autoshutdown_delay_ms}})` | 保持旧调用 |
| 语言 | `deviceSettingsSet({settings:{language}})` | 保持旧调用 |
| 触觉反馈 | `deviceSettingsSet({settings:{haptic_feedback}})` | 保持旧调用 |
| Passphrase | `deviceSettingsPageShow({page:'DevicePassphrase',fieldName:'passphrase_enable'})` | 保持 `deviceSettings({usePassphrase})` |
| 修改 PIN | `deviceSettingsPageShow({page:'DevicePinChange'})` | 保持旧 change PIN |
| wipe/reset | `deviceSettingsPageShow({page:'DeviceReset'})` | 保持 `deviceWipe` |
| 壁纸 | `deviceUploadWallpaper` | 保持 `deviceUploadResource`/homescreen |

Brightness 当前 App API 表达的是“打开设备亮度调整交互”，没有 brightness 数值参数。Pro2 不应凭空写入固定亮度；首版保留现有 UI 能力判断，若 Pro2 固件没有对应 settings page，则隐藏或禁用该入口，不映射到 `DeviceSettingsSet.brightness`。

Air-gap 当前没有独立 App service action。本次只为后续集中适配保留映射，不新增 UI。

## Passphrase 状态处理

Pro2 的 Passphrase 设置由设备页面完成，App 传入的 `passphraseEnabled` 只是用户发起操作时的期望，不代表设备页面最终选择。

流程：

1. 调用 `deviceSettingsPageShow(DevicePassphrase)`；
2. 页面结束后调用 `getFeaturesWithoutCache` 或等价刷新路径；
3. 使用设备返回的真实 `passphraseProtection` 更新 Local DB；
4. `ServiceHardware.setPassphraseEnabled` 不再对 Pro2 按请求 boolean 二次覆盖数据库。

Protocol V1 和 Trezor 保持现有精确更新逻辑。

## 壁纸流程

1. main 根据 Pro2 的 homescreen config 将图片 cover 裁剪为 604×1024 JPEG。
2. main 将现有 `screenHex` 传给 `serviceHardware.setDeviceHomeScreen`。
3. background 检测 Pro2，并校验 `screenHex` 非空。
4. background 使用 `jpeg-js.decode(bytes, {useTArray:true})` 得到 RGBA。
5. 校验解码尺寸严格为 604×1024，RGBA 长度严格为 2,473,984。
6. 调用：

```ts
hardwareSDK.deviceUploadWallpaper(connectId, {
  width: 604,
  height: 1024,
  rgba,
  fileName,
});
```

7. SDK 完成 LVGL 编码、目录创建、文件分块写入、`wallpaper_path` 设置和按错误自动解锁。

Pro2 不要求 thumbnail/blur 数据。Protocol V1 Pro/Touch 仍要求这些字段，不能删除现有校验。

## SDK 版本

app-monorepo 当前锁定 `1.2.0-alpha.10`，而上述 API 尚未包含在该版本。实施分为两步：

1. 先完成 app 代码与测试，类型暂时以目标 SDK API 为准；
2. hardware-js-sdk 发布包含 Protocol V2 settings/wallpaper 的新 alpha 后，统一更新根 `package.json`、resolutions 和 `yarn.lock` 中全部 `@onekeyfe/hd-*` 包。

不得只升级 `hd-core`，否则 common-connect-sdk 与 transport 可能产生类型或运行时版本错配。

## 错误处理

- Pro2 设置方法不预读 unlocked 状态；由 SDK 根据 Device locked 错误解锁重试。
- JPEG 解码失败、尺寸错误或空 screenHex 在发起设备调用前抛出明确本地错误。
- `deviceSettingsPageShow` 被用户取消时透传 SDK 取消错误，不更新数据库。
- 壁纸文件已上传但设置失败时由 SDK 保留文件，App 展示原始错误，允许用户重试。
- 不记录 RGBA、screenHex、设备序列号或其他敏感载荷。

## 测试

### DeviceSettingsManager 单元测试

- Pro2 label/语言/自动锁定/自动关机/haptic 映射到正确 `DeviceSettingsSet.settings` 字段；
- Protocol V1 仍调用 `deviceSettings`；
- Pro2 Passphrase/PIN/reset 映射到正确 page；
- Pro2 Passphrase 使用刷新后的真实状态更新 DB；
- 非 Pro2 Passphrase 保持请求值更新逻辑；
- Pro2 JPEG 解码后调用 `deviceUploadWallpaper`；
- 非 Pro2 彩屏仍调用 `deviceUploadResource`；
- Pro2 壁纸不要求 thumbnailHex/blurScreenHex；
- JPEG 尺寸不是 604×1024 时拒绝。

### 验证

- targeted Jest tests；
- `yarn agent:check --profile commit`；
- Desktop main/bg 真机验证设置与 USB 壁纸；
- Mobile main/bg 真机验证 BLE 壁纸和锁屏自动解锁；
- 验证 Protocol V1 Pro/Touch 壁纸、语言、Passphrase 无回归。

## 文件范围

- `packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.ts`
- `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts`
- `packages/kit-bg/src/services/ServiceHardware/*.test.ts`
- `packages/shared/src/utils/deviceHomeScreenUtils.ts`（仅在需要确保 Pro2 输出固定 JPEG 尺寸时修改）
- 根 `package.json`、`yarn.lock`（SDK 发布后）

不修改生成翻译、数据库 schema 或第三方硬件 adapter。
