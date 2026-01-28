# 固件升级迁移项目 PRD (修订版 v3 - 独立流程设计)

## 项目概述

### 目标
创建一个**完全独立的遗留设备升级流程**，支持 app-monorepo 当前不支持升级的低版本设备。

### 设计原则
**完全解耦** - 创建独立的服务、页面和路由，不修改任何现有代码。

### 为什么选择独立流程？

| 对比项 | 条件插入方案 | 独立流程方案 |
|-------|------------|------------|
| 现有代码改动 | 需要修改多个方法 | **零修改** |
| 逻辑位置 | 分散在多处 | **集中在独立模块** |
| 测试难度 | 需要测试各种条件组合 | **可独立测试** |
| 维护成本 | 需要理解两套逻辑交织 | **独立维护** |
| 风险 | 可能影响现有功能 | **完全隔离** |
| 未来移除 | 需要清理多处代码 | **删除独立模块即可** |

---

## 一、架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        固件升级入口                                   │
│                    (FirmwareUpdateDetect)                           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │     判断升级流程              │
              │  shouldUseLegacyFlow()      │
              └─────────────┬───────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│    现有升级流程         │       │   遗留设备升级流程      │
│  (不做任何修改)         │       │   (全新独立模块)        │
│                       │       │                       │
│  ServiceFirmware-     │       │  ServiceLegacy-       │
│  Update               │       │  FirmwareUpdate       │
│                       │       │                       │
│  PageFirmware-        │       │  PageLegacyFirmware-  │
│  UpdateInstall        │       │  Update               │
│                       │       │                       │
│  PageFirmware-        │       │                       │
│  UpdateInstallV2      │       │                       │
└───────────────────────┘       └───────────────────────┘
```

### 1.2 新增模块结构

```
packages/
├── kit-bg/src/services/
│   └── ServiceLegacyFirmwareUpdate/          # 新增：独立服务
│       ├── index.ts                          # 服务入口
│       ├── ServiceLegacyFirmwareUpdate.ts    # 主服务类
│       ├── touchFirmwareHandler.ts           # Touch 设备处理
│       ├── classicFirmwareHandler.ts         # Classic/Mini 设备处理
│       └── types.ts                          # 类型定义
│
├── kit/src/views/
│   └── LegacyFirmwareUpdate/                 # 新增：独立页面
│       ├── pages/
│       │   └── PageLegacyFirmwareUpdate.tsx  # 主页面
│       ├── components/
│       │   ├── LegacyUpdateCheckList.tsx     # 检查清单
│       │   ├── LegacyUpdateProgress.tsx      # 进度显示
│       │   ├── MiniBootloaderGuide.tsx       # Mini 引导
│       │   └── LegacyUpdateResult.tsx        # 结果显示
│       ├── hooks/
│       │   └── useLegacyFirmwareUpdate.ts    # 业务 Hook
│       └── router/
│           └── index.ts                      # 路由配置
│
└── shared/src/routes/
    └── legacyFirmwareUpdate.ts               # 新增：路由定义
```

### 1.3 流程判断逻辑

```typescript
/**
 * 判断是否应该使用遗留设备升级流程
 * 
 * 条件：
 * 1. Web 或 Extension 平台
 * 2. 设备版本低于最小限制
 */
function shouldUseLegacyFlow(params: {
  platform: string;
  deviceType: string;
  firmwareVersion: string;
  bootloaderVersion: string;
}): boolean {
  // 仅 Web/Extension 平台使用遗留流程
  if (!platformEnv.isWeb && !platformEnv.isExtension) {
    return false;
  }
  
  // Pro 设备无限制，不需要遗留流程
  if (params.deviceType === 'pro') {
    return false;
  }
  
  // 检查版本是否低于最小限制
  const minVersion = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED[params.deviceType];
  if (!minVersion) {
    return false;
  }
  
  return (
    semver.lt(params.firmwareVersion, minVersion.firmware) ||
    semver.lt(params.bootloaderVersion, minVersion.bootloader)
  );
}
```

---

## 二、设备升级流程覆盖

### 2.1 完整设备矩阵

| 设备 | 版本限制 | 现有流程 | 遗留流程 | 使用流程 |
|------|---------|---------|---------|---------|
| **Touch** | < 4.1.0 | ❌ 不支持 | ✅ 支持 | 遗留流程 |
| **Touch** | >= 4.1.0 | ✅ 支持 | - | 现有流程 |
| **Mini** | < 3.0.0 | ❌ 不支持 | ✅ 支持 | 遗留流程 |
| **Mini** | >= 3.0.0 | ✅ 支持 | - | 现有流程 |
| **Classic** | < 3.0.0 | ❌ 不支持 | ✅ 支持 | 遗留流程 |
| **Classic** | >= 3.0.0 | ✅ 支持 | - | 现有流程 |
| **Classic1s** | < 3.0.0 | ❌ 不支持 | ✅ 支持 | 遗留流程 |
| **Classic1s** | >= 3.0.0 | ✅ 支持 | - | 现有流程 |
| **ClassicPure** | < 3.0.0 | ❌ 不支持 | ✅ 支持 | 遗留流程 |
| **ClassicPure** | >= 3.0.0 | ✅ 支持 | - | 现有流程 |
| **Pro** | 任意 | ✅ 支持 | - | 现有流程 |

### 2.2 遗留流程处理逻辑

#### Touch 设备 (< 4.1.0)

```
┌─────────────────────────────────────────┐
│           Touch 遗留升级流程              │
├─────────────────────────────────────────┤
│                                         │
│  1. 检测固件版本                          │
│     ├── 3.4.x → 使用 firmware-v2 字段    │
│     └── 其他 → 使用 firmware 字段        │
│                                         │
│  2. 下载遗留固件                          │
│     └── https://data.onekey.so/touch/   │
│                                         │
│  3. 执行升级                             │
│     └── firmwareUpdateV2({ binary })    │
│                                         │
│  4. (可选) Bootloader 更新               │
│     └── deviceUpdateBootloader()        │
│                                         │
└─────────────────────────────────────────┘
```

#### Mini 设备 (< 3.0.0)

```
┌─────────────────────────────────────────┐
│           Mini 遗留升级流程               │
├─────────────────────────────────────────┤
│                                         │
│  1. 检测 Bootloader 模式                 │
│     ├── 是 → 继续                        │
│     └── 否 → 显示手动进入引导              │
│         ├── 断开 USB                     │
│         ├── 按住按钮                      │
│         ├── 插入 USB                     │
│         └── 松开按钮                      │
│                                         │
│  2. Bootloader 预检查                    │
│     └── checkBootloaderRelease()        │
│                                         │
│  3. (如需要) 更新 Bootloader             │
│     └── firmwareUpdateV2({              │
│           isUpdateBootloader: true      │
│         })                              │
│                                         │
│  4. 等待设备重启 (15秒)                   │
│                                         │
│  5. 执行固件更新                          │
│     └── firmwareUpdateV2()              │
│                                         │
└─────────────────────────────────────────┘
```

#### Classic / Classic1s / ClassicPure (< 3.0.0)

```
┌─────────────────────────────────────────┐
│       Classic 系列遗留升级流程            │
├─────────────────────────────────────────┤
│                                         │
│  1. Bootloader 预检查                    │
│     └── checkBootloaderRelease({        │
│           willUpdateFirmwareVersion     │
│         })                              │
│                                         │
│  2. (如需要) 更新 Bootloader             │
│     └── firmwareUpdateV2({              │
│           isUpdateBootloader: true      │
│         })                              │
│                                         │
│  3. 等待设备重启 (15秒)                   │
│                                         │
│  4. 执行固件更新                          │
│     └── firmwareUpdateV2()              │
│                                         │
│  5. (可选) 执行 BLE 更新                  │
│     └── firmwareUpdateV2({              │
│           updateType: 'ble'             │
│         })                              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 三、详细模块设计

### 3.1 ServiceLegacyFirmwareUpdate

```typescript
/**
 * 遗留设备固件升级服务
 * 
 * 设计原则：
 * - 完全独立，不依赖 ServiceFirmwareUpdate
 * - 内部状态管理，使用独立的 Jotai atoms
 * - 清晰的生命周期：init → update → done
 */
class ServiceLegacyFirmwareUpdate {
  
  // ==================== 入口方法 ====================
  
  /**
   * 判断是否应该使用遗留流程
   */
  shouldUseLegacyFlow(params: ILegacyFlowCheckParams): boolean
  
  /**
   * 开始遗留设备升级
   */
  async startLegacyUpdate(params: ILegacyUpdateParams): Promise<void>
  
  // ==================== 设备特定处理 ====================
  
  /**
   * Touch 设备升级
   */
  private async updateTouchDevice(params): Promise<void>
  
  /**
   * Mini 设备升级
   */
  private async updateMiniDevice(params): Promise<void>
  
  /**
   * Classic 系列设备升级
   */
  private async updateClassicDevice(params): Promise<void>
  
  // ==================== 辅助方法 ====================
  
  /**
   * 下载遗留固件
   */
  private async downloadLegacyFirmware(field): Promise<ArrayBuffer>
  
  /**
   * Bootloader 预检查和更新
   */
  private async preCheckBootloader(params): Promise<boolean>
  
  /**
   * 等待设备重启
   */
  private async waitDeviceRestart(): Promise<void>
}
```

### 3.2 页面组件设计

```typescript
/**
 * PageLegacyFirmwareUpdate
 * 
 * 遗留设备升级主页面
 * 步骤：检查 → 升级 → 完成
 */
function PageLegacyFirmwareUpdate() {
  const [step, setStep] = useState<'check' | 'update' | 'done'>('check');
  
  return (
    <Page>
      {step === 'check' && <LegacyUpdateCheckList />}
      {step === 'update' && <LegacyUpdateProgress />}
      {step === 'done' && <LegacyUpdateResult />}
    </Page>
  );
}
```

### 3.3 路由配置

```typescript
// shared/src/routes/legacyFirmwareUpdate.ts
export enum EModalLegacyFirmwareUpdateRoutes {
  LegacyUpdate = 'LegacyUpdate',
}

export type IModalLegacyFirmwareUpdateParamList = {
  [EModalLegacyFirmwareUpdateRoutes.LegacyUpdate]: {
    connectId: string | undefined;
    deviceType: string;
    currentFirmwareVersion: string;
    currentBootloaderVersion: string;
    targetFirmwareVersion?: string;
    isBootloaderMode?: boolean;
  };
};
```

---

## 四、入口集成点

### 4.1 唯一的修改点

**只需在入口处添加流程判断**，不修改任何现有升级逻辑：

```typescript
// 在 checkAllFirmwareRelease 返回后，判断使用哪个流程
const releaseResult = await serviceFirmwareUpdate.checkAllFirmwareRelease(params);

// 新增：判断是否使用遗留流程
const useLegacyFlow = serviceLegacyFirmwareUpdate.shouldUseLegacyFlow({
  deviceType: releaseResult.deviceType,
  firmwareVersion: releaseResult.updateInfos.firmware.fromVersion,
  bootloaderVersion: releaseResult.updateInfos.bootloader.fromVersion,
});

if (useLegacyFlow) {
  // 跳转到遗留升级页面
  navigation.push(EModalLegacyFirmwareUpdateRoutes.LegacyUpdate, {
    connectId,
    deviceType: releaseResult.deviceType,
    currentFirmwareVersion: releaseResult.updateInfos.firmware.fromVersion,
    currentBootloaderVersion: releaseResult.updateInfos.bootloader.fromVersion,
  });
} else {
  // 使用现有流程（完全不变）
  navigation.push(EModalFirmwareUpdateRoutes.Install, { result: releaseResult });
}
```

### 4.2 修改位置

| 文件 | 修改内容 | 改动量 |
|------|---------|-------|
| `useFirmwareUpdateActions.tsx` | 添加流程判断逻辑 | +20 行 |

**这是唯一需要修改的现有文件**，且仅在入口处添加判断。

---

## 五、文件清单

### 5.1 新增文件（完全独立）

| 文件路径 | 功能 | 行数估算 |
|---------|------|---------|
| **服务层** | | |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/index.ts` | 服务入口 | 20 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/ServiceLegacyFirmwareUpdate.ts` | 主服务 | 220 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/types.ts` | 类型定义 | 50 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/TouchFirmwareHandler.ts` | Touch 处理 | 80 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/MiniFirmwareHandler.ts` | Mini 处理 | 100 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/ClassicFirmwareHandler.ts` | Classic 处理 | 110 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/legacyFirmwareDownloader.ts` | 固件下载 | 30 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/bootloaderPreCheck.ts` | Bootloader 检查 | 60 |
| **状态管理** | | |
| `kit-bg/src/states/jotai/atoms/legacyFirmwareUpdate.ts` | 独立状态 atoms | 120 |
| **页面层** | | |
| `kit/src/views/LegacyFirmwareUpdate/pages/PageLegacyFirmwareUpdate.tsx` | 主页面 | 120 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateStepIndicator.tsx` | 步骤指示器 | 60 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateCheckList.tsx` | 检查清单 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateProgress.tsx` | 进度显示 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/components/MiniBootloaderGuide.tsx` | Mini 引导 | 70 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateResult.tsx` | 结果显示 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/hooks/useLegacyFirmwareUpdate.ts` | 业务 Hook | 80 |
| `kit/src/views/LegacyFirmwareUpdate/router/index.ts` | 路由配置 | 30 |
| **路由** | | |
| `shared/src/routes/legacyFirmwareUpdate.ts` | 路由定义 | 25 |

**总计新增：约 1600 行代码**

### 5.2 修改文件（最小改动）

| 文件 | 修改内容 | 改动量 |
|------|---------|-------|
| `kit-bg/src/states/jotai/atomNames.ts` | 添加 atom 名称枚举 | +5 行 |
| `kit-bg/src/states/jotai/atoms/index.ts` | 导出新 atoms | +3 行 |
| `kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions.tsx` | 添加流程判断 | +20 行 |
| `shared/src/routes/index.ts` | 导出新路由 | +2 行 |
| `kit-bg/src/BackgroundApiBase.ts` | 注册新服务 | +5 行 |

**总计修改：约 35 行代码**

---

## 六、迁移计划

### Phase 1: 基础架构搭建

- [ ] 在 `atomNames.ts` 添加新 atom 名称
- [ ] 创建 `legacyFirmwareUpdate.ts` atoms 文件
- [ ] 创建 `ServiceLegacyFirmwareUpdate` 服务框架和类型定义
- [ ] 注册服务到 BackgroundApi
- [ ] 创建路由定义 `legacyFirmwareUpdate.ts`
- [ ] 创建页面框架 `PageLegacyFirmwareUpdate.tsx`

### Phase 2: Touch 设备支持

- [ ] 实现 `handlers/TouchFirmwareHandler.ts`
- [ ] 实现 `utils/legacyFirmwareDownloader.ts` (Touch 遗留固件下载)
- [ ] 集成到主服务
- [ ] 测试 Touch < 4.1.0 升级

### Phase 3: Mini 设备支持

- [ ] 实现 `handlers/MiniFirmwareHandler.ts`
- [ ] 实现 `utils/bootloaderPreCheck.ts`
- [ ] 实现 `MiniBootloaderGuide.tsx` 组件
- [ ] 处理 WebUSB 重新选择设备场景
- [ ] 测试 Mini < 3.0.0 升级

### Phase 4: Classic 设备支持

- [ ] 实现 `handlers/ClassicFirmwareHandler.ts`
- [ ] 支持 Classic, Classic1s, ClassicPure 三种设备
- [ ] 支持可选的 BLE 升级
- [ ] 测试 Classic 系列 < 3.0.0 升级

### Phase 5: 入口集成与测试

- [ ] 在 `useFirmwareUpdateActions` 添加流程判断逻辑
- [ ] 实现所有 UI 组件
- [ ] 端到端测试所有设备类型
- [ ] 回归测试现有升级流程（确保未被影响）

---

## 七、验收标准

### 功能验收

- [ ] Touch < 4.1.0 设备可以升级
- [ ] Mini < 3.0.0 设备可以升级（带引导）
- [ ] Classic/Classic1s/ClassicPure < 3.0.0 设备可以升级
- [ ] 升级流程与 firmware-updater-web 一致

### 解耦验收

- [ ] **现有代码零修改**（仅入口添加判断）
- [ ] 遗留模块可独立测试
- [ ] 删除遗留模块后现有功能正常
- [ ] Native 平台行为完全不变

### 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] TypeScript 类型完整
- [ ] 无 lint 错误
