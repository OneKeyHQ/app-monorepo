# Pro 2 Protocol、Settings 与 Firmware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 App 使用 firmware-pro2 最新 dev 协议，完整接通 Pro 2 onboarding、四类 Settings API 与当前支持的 firmware 更新目标。

**Architecture:** `firmware-pro2 origin/dev` 是 protobuf 单一来源，`hardware-js-sdk feat/pro2-usb-ble` 负责生成类型和运行时 schema。由于新版 npm 包尚未发布，App 使用从同一 SDK 产物生成的 patch-package 补丁作为临时依赖桥接，并在业务代码中直接消费 SDK 生成类型。

**Tech Stack:** TypeScript、Jest、React/React Native、Jotai、`@onekeyfe/hd-core`、`@onekeyfe/hd-transport`、protobufjs、patch-package。

---

### Task 1: 验证 SDK 与 firmware-pro2 协议同步

**Files:**
- Modify if generated output changes: `/Users/caikaisheng/Documents/GitHub/hardware-js-sdk/packages/hd-transport/messages-protocol-v2.json`
- Modify if generated output changes: `/Users/caikaisheng/Documents/GitHub/hardware-js-sdk/packages/hd-transport/src/types/messages.ts`
- Modify if generated output changes: `/Users/caikaisheng/Documents/GitHub/hardware-js-sdk/packages/core/src/data/messages/messages-protocol-v2.json`
- Test: `/Users/caikaisheng/Documents/GitHub/hardware-js-sdk/packages/hd-transport/__tests__/messages.test.js`
- Test: `/Users/caikaisheng/Documents/GitHub/hardware-js-sdk/packages/core/__tests__/protocol-v2.test.ts`

- [ ] **Step 1: 写入协议契约测试**

在 messages 测试中断言生成 schema 包含新 onboarding 字段与全部 Settings/Firmware 枚举：

```js
expect(statusFields).toMatchObject({
  step: expect.objectContaining({ type: 'DevOnboardingStep' }),
  phase: expect.objectContaining({ type: 'DevOnboardingPhase' }),
  setup: expect.objectContaining({ type: 'DevOnboardingSetupStatus' }),
  pin_set: expect.any(Object),
  wallet_initialized: expect.any(Object),
});
expect(deviceSettingsFields).toHaveProperty('brightness');
expect(deviceSettingsFields).toHaveProperty('random_keypad');
expect(firmwareTargets).toMatchObject({
  FW_MGMT_TARGET_BOOTLOADER: 3,
  FW_MGMT_TARGET_APPLICATION_P1: 4,
  FW_MGMT_TARGET_APPLICATION_P2: 5,
  FW_MGMT_TARGET_COPROCESSOR: 6,
  FW_MGMT_TARGET_SE01: 7,
  FW_MGMT_TARGET_SE04: 10,
});
```

- [ ] **Step 2: 运行测试确认当前生成物状态**

Run: `yarn workspace @onekeyfe/hd-transport test --runInBand`

Expected: 若生成物未同步则 FAIL；若已同步则记录为协议基线测试，并通过临时反向断言确认测试能捕获旧 stage schema。

- [ ] **Step 3: 更新 firmware 子模块并重新生成 protobuf**

```bash
git -C /Users/caikaisheng/Documents/GitHub/hardware-js-sdk submodule update --init submodules/firmware-pro2
yarn --cwd /Users/caikaisheng/Documents/GitHub/hardware-js-sdk update-protobuf
```

Expected: 子模块为 `e4884ae8` 或更新的 `origin/dev` 提交，生成物包含 `DevOnboardingStep`，不再包含 `DevOnboardingStage`。

- [ ] **Step 4: 补充 SDK API 测试**

```ts
expect(await method.run()).toEqual({
  step: DevOnboardingStep.DEV_ONBOARDING_STEP_SETUP,
  phase: DevOnboardingPhase.DEV_ONBOARDING_PHASE_SETUP_CHOICE,
  setup: { kind: DevOnboardingSetupKind.DEV_ONBOARDING_SETUP_KIND_CHOICE },
  pin_set: true,
  wallet_initialized: false,
});
expect(typedCall).toHaveBeenCalledWith(
  'DevGetOnboardingStatus',
  'DevOnboardingStatus',
  {},
);
```

- [ ] **Step 5: 运行 SDK 测试与构建**

Run:

```bash
yarn --cwd /Users/caikaisheng/Documents/GitHub/hardware-js-sdk workspace @onekeyfe/hd-transport test --runInBand
yarn --cwd /Users/caikaisheng/Documents/GitHub/hardware-js-sdk workspace @onekeyfe/hd-core test protocol-v2.test.ts --runInBand
yarn --cwd /Users/caikaisheng/Documents/GitHub/hardware-js-sdk workspace @onekeyfe/hd-transport build
yarn --cwd /Users/caikaisheng/Documents/GitHub/hardware-js-sdk workspace @onekeyfe/hd-core build
```

Expected: 全部 exit 0。

### Task 2: 生成 App 的 SDK 协议临时补丁

**Files:**
- Create: `patches/@onekeyfe+hd-transport+1.2.0-alpha.16.patch`
- Create: `patches/@onekeyfe+hd-core+1.2.0-alpha.16.patch`
- Modify only for patch generation: `node_modules/@onekeyfe/hd-transport/**`
- Modify only for patch generation: `node_modules/@onekeyfe/hd-core/**`
- Test: `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts`

- [ ] **Step 1: 写入真实 SDK 契约失败测试**

```ts
import {
  DevOnboardingPhase,
  DevOnboardingSetupKind,
  DevOnboardingStep,
} from '@onekeyfe/hd-transport';

expect(DevOnboardingStep.DEV_ONBOARDING_STEP_DONE).toBe(5);
expect(DevOnboardingPhase.DEV_ONBOARDING_PHASE_SEEDCARD_BACKUP).toBe(13);
expect(DevOnboardingSetupKind.DEV_ONBOARDING_SETUP_KIND_RESTORE).toBe(3);
```

- [ ] **Step 2: 运行测试确认旧 alpha.16 失败**

Run: `yarn jest packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts --runInBand`

Expected: FAIL，提示新枚举未导出。

- [ ] **Step 3: 用 SDK 构建产物更新 node_modules**

复制 `hardware-js-sdk` 中 hd-transport/hd-core 的协议 JSON、生成类型和运行时 dist 文件到 App 对应 package；只复制与 protobuf/API 契约相关的文件，不复制缓存、coverage 或平台 build 目录。

- [ ] **Step 4: 按 1k-patch-package-workflow 生成补丁**

```bash
cp package.json /tmp/app-monorepo-package.json.bak
node -e "const fs=require('fs');const p=require('./package.json');delete p.resolutions;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
npx patch-package @onekeyfe/hd-transport
npx patch-package @onekeyfe/hd-core
cp /tmp/app-monorepo-package.json.bak package.json
```

- [ ] **Step 5: 验证补丁不包含无关构建产物**

```bash
git apply --check -p1 patches/@onekeyfe+hd-transport+1.2.0-alpha.16.patch
git apply --check -p1 patches/@onekeyfe+hd-core+1.2.0-alpha.16.patch
test "$(grep -c 'android/build' patches/@onekeyfe+hd-transport+1.2.0-alpha.16.patch || true)" = 0
test "$(grep -c 'android/build' patches/@onekeyfe+hd-core+1.2.0-alpha.16.patch || true)" = 0
```

- [ ] **Step 6: 重新运行契约测试确认通过**

Run: `yarn jest packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts --runInBand`

Expected: PASS。

### Task 3: App onboarding 使用 SDK 生成类型

**Files:**
- Modify: `packages/kit/src/views/Onboardingv2/pages/pro2OnboardingStatus.ts`
- Modify: `packages/kit/src/views/Onboardingv2/pages/pro2OnboardingStatus.test.ts`
- Modify: `packages/kit/src/views/Onboardingv2/pages/deviceSetupPro2.tsx`
- Modify: `packages/kit/src/views/Onboardingv2/pages/DeviceSetup.tsx`
- Modify: `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts`

- [ ] **Step 1: 扩展 Mapper 失败测试**

用 `it.each` 覆盖所有 `DevOnboardingStep`、所有 `DevOnboardingPhase`，特别断言：

```ts
expect(mapPro2OnboardingStatus({
  step: DevOnboardingStep.DEV_ONBOARDING_STEP_SETUP,
  phase: DevOnboardingPhase.DEV_ONBOARDING_PHASE_SEEDCARD_BACKUP,
  setup: {
    kind: DevOnboardingSetupKind.DEV_ONBOARDING_SETUP_KIND_CREATE,
    method: DevOnboardingSetupMethod.DEV_ONBOARDING_SETUP_METHOD_SEEDCARD,
  },
})).toMatchObject({
  phase: 'backup',
  step: EPro2OnboardingStep.Setup,
  setup: { kind: 'create', card: 'seedCard' },
});
```

- [ ] **Step 2: 运行 Mapper 测试确认失败**

Run: `yarn jest packages/kit/src/views/Onboardingv2/pages/pro2OnboardingStatus.test.ts --runInBand`

Expected: FAIL，因为当前 Mapper 不使用 SDK enum，且不会返回 backup。

- [ ] **Step 3: 最小实现 SDK 类型 Mapper**

```ts
import {
  DevOnboardingPhase,
  DevOnboardingSetupKind,
  DevOnboardingSetupMethod,
  DevOnboardingStep,
  type DevOnboardingStatus,
} from '@onekeyfe/hd-transport';

export type IPro2OnboardingStatus = DevOnboardingStatus;
```

使用 enum 正向/反向值规范化，并让 SeedCard backup phases 返回 `phase: 'backup'`。删除 `DeviceSetup.tsx` 中的 `as IPro2OnboardingStatus` 强制断言。

- [ ] **Step 4: 运行 onboarding 测试**

Run:

```bash
yarn jest packages/kit/src/views/Onboardingv2/pages/pro2OnboardingStatus.test.ts packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts --runInBand
```

Expected: PASS。

### Task 4: Pro 2 DeviceStatus 与 Settings 通用接口

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts`
- Modify: `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2DeviceManagement.test.ts`
- Modify: `packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.ts`
- Modify: `packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.pro2.test.ts`
- Modify: `packages/kit/src/states/jotai/contexts/deviceDetails/pro2DeviceManagement.ts`
- Modify: `packages/kit/src/states/jotai/contexts/deviceDetails/pro2DeviceManagement.test.ts`

- [ ] **Step 1: 写 DeviceStatus 完整状态失败测试**

```ts
expect(buildPro2DeviceMetaState({ isVerified: true, snapshot })).toMatchObject({
  initialized: true,
  backupRequired: true,
  unlocked: false,
  unlockedByAttachToPin: false,
  settingsAccessible: false,
});
```

- [ ] **Step 2: 写四类 Settings API 失败测试**

覆盖 `deviceSettingsGet`、任意精确 `deviceSettingsSet`、四个 `deviceSettingsPageShow` 页面以及 `deviceUploadWallpaper`。亮度测试必须断言 Pro 2 使用：

```ts
expect(deviceSettingsSet).toHaveBeenCalledWith('PRO2_CONNECT_ID', {
  settings: { brightness: 60 },
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
yarn jest packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.pro2.test.ts packages/kit/src/states/jotai/contexts/deviceDetails/pro2DeviceManagement.test.ts --runInBand
```

Expected: FAIL，当前缺少 brightness V2 路由和完整状态字段。

- [ ] **Step 4: 实现精确 Settings API 与状态映射**

新增严格类型的后台方法：

```ts
async getPro2DeviceSettings(params: { connectId: string }): Promise<DeviceSettings>
async setPro2DeviceSettings(params: {
  connectId: string;
  settings: Omit<DeviceSettings, 'passphrase_enable' | 'airgap_mode'>;
}): Promise<DeviceSuccess>
async showPro2DeviceSettingsPage(params: {
  connectId: string;
  page: SupportedDeviceSettingsPage;
  fieldName?: string;
}): Promise<DeviceSuccess>
```

现有产品操作调用这些 V2 方法；Pro 2 brightness 使用 `{ brightness }`，锁定状态不请求私有 Settings。

- [ ] **Step 5: 运行 Settings 与状态测试**

Run:

```bash
yarn jest packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.pro2.test.ts packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2DeviceManagement.test.ts packages/kit/src/states/jotai/contexts/deviceDetails/pro2DeviceManagement.test.ts --runInBand
```

Expected: PASS。

### Task 5: 打开 Pro 2 现有设备管理入口

**Files:**
- Modify: `packages/shared/src/utils/deviceUtils.ts`
- Create or Modify: `packages/shared/src/utils/deviceUtils.pro2Settings.test.ts`
- Modify: `packages/kit/src/views/DeviceManagement/pages/DeviceDetailsModal/DeviceSectionGeneral.tsx`

- [ ] **Step 1: 写能力判断失败测试**

```ts
it.each([
  ESupportSettings.Language,
  ESupportSettings.Brightness,
  ESupportSettings.AutoLock,
  ESupportSettings.AutoShutDown,
  ESupportSettings.HapticFeedback,
])('enables %s for Pro2', (setting) => {
  expect(deviceUtils.supportSettings({
    deviceType: EDeviceType.Pro2,
    firmwareVersion: '1.0.0',
    setting,
  })).toBe(true);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `yarn jest packages/shared/src/utils/deviceUtils.pro2Settings.test.ts --runInBand`

Expected: FAIL，因为当前只允许 `EDeviceType.Pro`。

- [ ] **Step 3: 实现 Pro 2 能力矩阵**

`supportSettings` 对 Pro 2 不使用旧 Pro 的 `4.19.0` 版本门槛；按最新 protobuf 明确允许语言、亮度、自动锁定、自动关机和触觉反馈。锁定时所有需要读取当前值的入口 disabled，壁纸交给 SDK 的解锁策略。

- [ ] **Step 4: 运行能力与设备管理测试**

Run:

```bash
yarn jest packages/shared/src/utils/deviceUtils.pro2Settings.test.ts packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.pro2.test.ts --runInBand
```

Expected: PASS。

### Task 6: 补齐 firmware-pro2 目标与状态

**Files:**
- Modify: `packages/shared/types/device.ts`
- Modify: `packages/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate.ts`
- Modify or Create: `packages/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate.pro2.test.ts`
- Modify: `packages/kit/src/views/Setting/pages/FirmwareUpdateDevSettings/PageFirmwareUpdatePro2DevSettings.tsx`

- [ ] **Step 1: 写目标矩阵失败测试**

```ts
expect(getPro2FirmwareUpdateTargetsForTest()).toEqual([
  'boot', 'app_v1', 'app_v2', 'coprocessor', 'resource',
  'se01', 'se02', 'se03', 'se04',
]);
```

测试同时断言 romloader 不进入普通更新请求，`resource` 不映射为 `DeviceFirmwareTargetType`。

- [ ] **Step 2: 写状态分类失败测试**

```ts
expect(classifyPro2FirmwareTaskStatus(
  DeviceFirmwareUpdateTaskStatus.FW_MGMT_UPDATER_TASK_STATUS_FAILED_VERIFY,
)).toBe('failed');
expect(classifyPro2FirmwareTaskStatus(
  DeviceFirmwareUpdateTaskStatus.FW_MGMT_UPDATER_TASK_STATUS_FINISHED,
)).toBe('finished');
```

- [ ] **Step 3: 运行测试确认失败**

Run: `yarn jest packages/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate.pro2.test.ts --runInBand`

Expected: FAIL，开发页当前缺少 coprocessor，且没有集中状态分类测试入口。

- [ ] **Step 4: 实现目标与状态单源**

导出共享的 Pro 2 目标常量供服务和开发页使用，加入 coprocessor；状态分类覆盖 protobuf 的 pending、in-progress、finished 和 8 个 failure 状态，不把未知值当成功。

- [ ] **Step 5: 运行 firmware 测试**

Run: `yarn jest packages/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate.pro2.test.ts --runInBand`

Expected: PASS。

### Task 7: 综合验证

**Files:**
- Verify: both repositories' changed files

- [ ] **Step 1: 运行全部 Pro 2 定向测试**

```bash
yarn jest \
  packages/kit-bg/src/services/ServiceHardware/DeviceSettingsManager.pro2.test.ts \
  packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2DeviceManagement.test.ts \
  packages/kit-bg/src/services/ServiceHardware/ServiceHardware.pro2Onboarding.test.ts \
  packages/kit/src/states/jotai/contexts/deviceDetails/pro2DeviceManagement.test.ts \
  packages/kit/src/views/Onboardingv2/pages/pro2OnboardingStatus.test.ts \
  packages/shared/src/utils/deviceUtils.pro2Settings.test.ts \
  packages/kit-bg/src/services/ServiceFirmwareUpdate/ServiceFirmwareUpdate.pro2.test.ts \
  --runInBand
```

Expected: 0 failed suites、0 failed tests。

- [ ] **Step 2: 运行 App 检查**

Run:

```bash
yarn agent:check --profile commit
yarn tsc:only
```

Expected: commit profile 通过；若全量 tsc 仍被既有 Trezor connector 类型缺失阻断，确认没有新增 Pro 2 错误并记录原始错误文件。

- [ ] **Step 3: 验证安装可复现性**

在临时目录从 Yarn cache 解压 pristine alpha.16 包，分别执行两个 patch 的 `git apply --check -p1`，确认补丁可应用且不包含 `android/build` 等生成目录。

- [ ] **Step 4: 检查最终 diff**

```bash
git status --short
git diff --check
git -C /Users/caikaisheng/Documents/GitHub/hardware-js-sdk status --short
git -C /Users/caikaisheng/Documents/GitHub/hardware-js-sdk diff --check
```

Expected: 无空白错误；只包含 Pro 2 协议、Settings、firmware、测试和临时依赖补丁。
