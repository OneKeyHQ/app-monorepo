# Keyless Wallet 产品开发文档

本文聚焦产品流程，不展开底层加解密实现。所有流程围绕 `ServiceKeylessWallet.ts` 中的能力展开，便于产品、前端和后台协作。

---

## 相关模块与角色
- `ServiceKeylessWallet.buildKeylessWalletUserInfo()`：复用 `primePersistAtom` 的登录态，若未登录 OneKeyID 直接抛错，确保初始化/启用入口前置校验在一个方法内完成。
- `ServiceKeylessWallet.generateKeylessWalletPacks()` 与 `keylessWalletUtils.ts`：负责生成 `devicePack`、`cloudPack`、`authPack`，并生成 `packSetId`。
- `ServiceKeylessWallet.backupCloudKeyPack()`、`restoreCloudKeyPack()`：联合 `serviceCloudBackupV2` 完成本地与云盘之间的读写。
- `ServiceKeylessWallet.restoreKeylessWallet()`：已经包含 `packSetId` 一致性校验与 2-of-3 恢复逻辑，可复用到启用与恢复流程。
- `ServiceKeylessWallet.sendDeviceKeyPack()` / `receiveDeviceKeyPack()`：提供 Prime Transfer 的扫码/二维码恢复入口。
- `appStorage.secureStorage`（`appStorage.ts` & `appStorageBuildFactory.ts`）以及 `secureStorage/index.ts`：用于本地安全存储，支持 `setSecureItem/getSecureItem/removeSecureItem`。
- `settingsPersistAtom.sensitiveEncodeKey` 与 `isBiologyAuthSwitchOn`：提供本地加密种子与是否启用生物识别加持的偏好，供 `authPack` 的内存缓存加密使用。

---

## 流程一：初始化 Keyless 钱包

### 前置判断
1. 调用 `buildKeylessWalletUserInfo()`，如果 `primePersistAtom` 未登录或 OneKeyID 缺失邮箱/ID，则弹窗引导用户登录。
 2. 向服务器查询 OneKeyID 的初始化状态，可读取 `primePersistAtom` 中的 `keylessWalletId`（`primeTypes.ts`），该字段即后续流程使用的 `packSetId`。若其存在且服务器侧记录一致，则判定已初始化，提示报错并终止流程，避免重复生成。

### 未初始化时的完整步骤
1. 云盘能力检查：通过 `serviceCloudBackupV2.supportCloudBackup()`。若返回不支持，则提示“请在移动端完成初始化”，流程结束。
2. 生成三把 key packs：
   - 调用 `generateKeylessWalletPacks()`，内部会拉取用户信息并生成新的 `packSetId`。
3. 三个 Pack 的处理方式：
  - **devicePack**
    - 将完整结构通过 `stringUtils.stableStringify` 转成文本（内部 `encrypted`、`*_PwdSlice` 本身已是 base64）。
    - 调用 `saveDevicePackToStorage(devicePack)`（见文末公共方法说明）完成安全存储写入。每个 `packSetId` 都有独立 key（如 `devicePack:f1e2...`），避免「读取旧 map + 回写新 map」而触发两次生物识别交互。
   - **cloudPack**
     - 直接把 `cloudKeyPack` 对象放入 `backupCloudKeyPack({ payload: { cloudKeyPack }, allowDuplicate: false })`；底层 `serviceCloudBackupV2.backupKeylessWalletData()` 会在 iCloud/Google Drive provider 内使用 `stringUtils.stableStringify`（`backupProviders/ICloudBackupProvider.ts:300-310`、`backupProviders/GoogleDriveBackupProvider.ts:250-266`）序列化为 JSON，无需额外 base64。
     - 写入后执行同一方法返回值的校验逻辑，确保 `downloadKeylessWallet` 返回内容与 `backupKeylessWalletData` 原始 `content` 一致。
     - 云盘账号信息沿用 `buildKeylessWalletUserInfo()` 返回的 `cloudKeyProvider` 与 `cloudKeyUserId`。
  - **authPack**
    - 将 pack 直接用 `stringUtils.stableStringify` 转成文本，作为服务器接口的 body，服务器侧需要触发 OTP。OTP 请求/校验可以直接复用 OneKeyID 现有实现：`servicePrime.sendEmailOTP()`（`ServicePrime.tsx`）负责请求验证码，前端通过 `useLoginOneKeyId().sendEmailOTP()`（`useLoginOneKeyId.tsx`）弹出 `EmailOTPDialog` 并在 `onConfirm` 中把 `{ code, uuid }` 传回后台，再搭配新的 AuthPack API 完成上传。
    - 在 `ServiceKeylessWallet` 内存中维护一个 `authPackCache`（例如 service 成员变量），用于启用流程快速命中，写入统一调用 `cacheAuthPackInMemory()`。
    - `authPack` 只保留在内存中，不做持久化，避免与本地 `devicePack` 同时落地造成额外风险。若需要在内存里缓存结果，亦通过 `cacheAuthPackInMemory()` 走加密缓存，不出现明文 authKey。

### 初始化完成的交付
- 返回状态给前端，提示“已完成初始化，可直接启用”。
- 记录 `packSetId`，供后续启用和恢复流程比对。

---

## 流程二：启用 Keyless 钱包

### 入口检查
1. 调用 `buildKeylessWalletUserInfo()` 确保登录。
2. 查询服务器 `authKey` 状态：
   - 若未初始化，跳转回初始化流程。
   - 若已初始化，继续启用。

### Pack 拉取策略（互相独立，禁止方法内互相调用）
1. **devicePack**
   - 首选 `appStorage.secureStorage.getSecureItem(computeDevicePackKey(packSetId))`。
   - 若读取失败但成功拿到另外任意两个 pack，调用 `restoreKeylessWallet()` 的组合恢复 device pack，再调用 `saveDevicePackToStorage()` 保持与初始化一致的写入流程。
2. **authPack**
   - 优先读 `ServiceKeylessWallet` 的内存缓存。
   - 若缓存缺失且设备支持云盘静默访问，调用 `restoreCloudKeyPack(packSetId)` 下载 cloud pack，使用 `keylessWalletUtils.restoreFromAuthAndCloud()` 重建 `authPack`，并通过 `cacheAuthPackInMemory()` 刷新内存缓存。
   - 若仍失败，发起服务器接口请求 OTP -> 下发 `authPack`，拿到后立即调用 `cacheAuthPackInMemory()`，杜绝任何形式的本地持久化。
3. **cloudPack**
   - 仅在以下场景才尝试读取：① 指纹/FaceID 失效导致 device pack 无法从 secureStorage 解锁；② 内存里不存在与当前 `packSetId` 匹配的 `authPackCache`。此时可通过 `restoreCloudKeyPack(packSetId)` 拉取 cloud pack，配合其他 pack 恢复缺失部分。
   - 若云盘不可用且仍需 cloud pack，直接提示用户前往支持云盘的平台执行初始化或恢复，避免在非云端环境重复备份。

### 一致性与错误处理
- `restoreKeylessWallet()` 已封装 `packSetId` 检查，所有 pack 拉取完成后必须调用它做最终校验。
- 若 `packSetId` 不一致，直接中断启用并提示“请重新同步或扫描二维码恢复”。
- 当仅能恢复出一个 pack 时，立即提示用户进入“手动恢复流程”，不要继续尝试自动启用。
- 启用流程完成后，将 `restoreKeylessWallet()` 返回的助记词（或实体钱包数据）交给业务侧（详情页、资产刷新等）使用，后续创建/导入逻辑由业务层处理。

## 流程三：手动恢复

### 前提
- 默认 `authPack` 可通过 OTP 或内存缓存获取（启用流程已保证）。
- 用户可在任意端进入 Prime Transfer（`sendDeviceKeyPack()` / `receiveDeviceKeyPack()`）页面。

### 恢复方式
1. **支持云盘的设备**
   - 提供“云盘恢复”按钮：静默拉取 `cloudPack`（同 `restoreCloudKeyPack()`），与 `authPack` 或 `devicePack` 组合。
   - 同时提供“扫码恢复”入口：`receiveDeviceKeyPack()` 展示 QR，另一台设备通过 `sendDeviceKeyPack()` 推送缺失的 pack。
2. **不支持云盘的设备**
   - 仅保留二维码扫码方式，通过 Prime Transfer 互传 `devicePack` 或 `cloudPack`。

### 流程细节
- 无论使用哪种组合，最终都统一走 `restoreKeylessWallet()`，保证 `packSetId` 校验与恢复逻辑一致。
- 恢复后需回写本地状态：
  - `devicePack` -> 调用 `saveDevicePackToStorage()`。
- `cloudPack` -> 若已恢复成功即视为启用流程完成，不再自动备份，避免重复写入云盘。
- `authPack` -> 只更新内存缓存（统一调用 `cacheAuthPackInMemory()`），不落地。

---

## OTP 触发点（TODO）
- 初始化阶段上传 `authPack` 时，需要调用 OTP 验证接口（复用现有登录安全流程）。
- 启用阶段的“服务器拉取 `authPack`”同样需要 OTP，以确认是本人操作。
- 具体接口需与后台协商后补充到 `ServiceKeylessWallet`，暂以 TODO 标注。

---

## 流程依赖清单
- 登录状态：`primePersistAtom`（OneKeyID）。
- 云盘：`serviceCloudBackupV2.supportCloudBackup()`、`getCloudAccountInfo()`。
- OTP：`servicePrime.sendEmailOTP()` 负责发送验证码，前端通过 `useLoginOneKeyId().sendEmailOTP()` 与 `EmailOTPDialog` 统一弹窗和提交 `{ code, uuid }`。
- 安全存储：`appStorage.secureStorage`（`setSecureItem` / `getSecureItem` / `setSecureItemWithBiometrics`）。
- 加密种子：`settingsPersistAtom.sensitiveEncodeKey` + `isBiologyAuthSwitchOn`。
- Pack 组合与校验：`keylessWalletUtils.restoreFromDeviceAndAuth | restoreFromDeviceAndCloud | restoreFromAuthAndCloud`。
- Prime Transfer：`sendDeviceKeyPack()`、`receiveDeviceKeyPack()`。

---

## 公共方法：saveDevicePackToStorage(devicePack: IDeviceKeyPack)
- **能力**：统一封装 device pack 的安全落地逻辑，供初始化、启用及手动恢复复用。为了减少生物识别弹窗，每个 wallet 使用独立 key 存储，避免「先读 map 再写 map」带来的二次认证。
- **行为**：
  1. 先通过 `computeDevicePackKey(packSetId)` 构建唯一 key，确保多钱包共存。
  2. 调用 `appStorage.secureStorage.supportSecureStorage()` 判断能力。
  3. 使用 `stringUtils.stableStringify(devicePack)` 生成 `jsonString`。
  4. 支持 secureStorage 时优先 `setSecureItemWithBiometrics(key, jsonString)`，若用户关闭生物识别则降级为 `setSecureItem`。示例：
     - `key = OneKey_Keyless__${packSetId}`（如 `OneKey_Keyless__f1e2d3c4b5a697887766554433221100`）
     - key 的生成不要写死，而是封装函数到 accountUtils 里，统一调用
     - `jsonString = stringUtils.stableStringify(deviceKeyPack)`，直接存整份 pack，可并存多份不同 `packSetId`。
  5. 在非桌面/非移动端等不支持 secureStorage 的环境下：
     - 使用 `servicePassword.promptPasswordVerify()` 获取 passcode。
     - 调用 `servicePassword.encryptString()` 以 passcode 加密 `jsonString`。
     - 通过 `appStorage.setItem(key, encryptedPayload)` 存储。
  6. 一旦用户重新启用生物识别或 secureStorage 能力恢复，写入 secureStorage 前需删除 `appStorage` 里的兜底副本，避免同一份数据存在两份不同安全级别的存储。

## 公共方法：cacheAuthPackInMemory(authPackString: string)
- **能力**：对传入的 `authPack` 文本做最小化加密后缓存在内存，避免任何磁盘落地。
- **行为**：
  1. 使用 `settingsPersistAtom.sensitiveEncodeKey` 与当前 session passcode 组合成密钥，通过 `servicePassword.encryptString()` 对 `authPack` 文本加密，进一步降低缓存被复用的风险。
  2. 将加密结果写入 `ServiceKeylessWallet` 的内存字段（如 `authPackCache`），并根据 `packSetId` 维护索引，确保命中正确钱包。
  3. 当用户登出 OneKeyID 或切换账号时，清空对应缓存，避免跨账号泄露。
  4. 若需要在同一 session 内刷新缓存（例如 OTP 拉取后替换旧数据），需先删除旧索引再写入，保证缓存始终唯一。

通过以上约束即可实现“初始化—启用—手动恢复”的闭环，且满足「三把 pack 独立拉取、 packSetId 校验、 OTP 补强」等产品要求。***


---

## 开发待办
- [ ] `ServiceKeylessWallet` 内实现 `saveDevicePackToStorage()`：内部自带 secureStorage / appStorage 兜底逻辑，两套存储保持独立、互不调用。
- [ ] `ServiceKeylessWallet` 内实现 `cacheAuthPackInMemory()`，并串接云盘/OTP 缺失缓存的补链逻辑。
- [ ] 定义三把 key 拉取方法（`getKeylessDevicePack()`、`getKeylessAuthPack()`、`getKeylessCloudPack()`），对 device/auth/cloud 数据来源进行封装，便于启用/恢复流程复用。
- [ ] 接入 `servicePrime.sendEmailOTP()` + `useLoginOneKeyId().sendEmailOTP()`，完成初始化、启用流程的验证码验证。
- [ ] 在前端界面呈现 OneKeyID 登录状态、云盘能力、OTP 弹窗，串联 Prime Transfer 发送/接收交互。
- [ ] 在 gallery 提供带二次确认的测试按钮，清除本地 devicePack（secureStorage + appStorage 兜底）并删除云盘上的 cloudPack（调用 backup 服务删除接口）。

## 测试待办
- [ ] 在支持云盘的设备上走完整初始化流程，核查三把 pack 生成与存储位置（secureStorage / 云盘 / 服务器）。
- [ ] 模拟只保留部分 pack 的场景，执行启用流程并确认助记词正确返回、device pack 被重新落地。
- [ ] 验证 secureStorage 不可用时的 appStorage + passcode 兜底链路，以及恢复 biometrics 后的 fallback 清理。
- [ ] 在云盘不可用、OTP 失败/超时等边界情况下，检查提示与重试逻辑。
- [ ] 覆盖手动恢复：云盘静默恢复、Prime Transfer 扫码恢复，确认 `saveDevicePackToStorage()` 与 `cacheAuthPackInMemory()` 调用正确。
- [ ] 多钱包共存测试：同一设备创建多个 keyless 钱包，确保 `devicePack:${packSetId}` 互不覆盖，authPack 只缓存当前 OneKeyID。
