# 固件升级迁移 - 技术规格文档 (修订版 v3 - 独立流程设计)

## 一、架构设计

### 1.1 模块关系图

```
                                    ┌─────────────────────┐
                                    │   固件升级入口       │
                                    │ useFirmwareUpdate-  │
                                    │ Actions             │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  shouldUseLegacy-   │
                                    │  Flow()             │
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
                    ▼                          │                          ▼
    ┌───────────────────────────┐              │          ┌───────────────────────────┐
    │      现有升级流程           │              │          │      遗留升级流程          │
    │   (不做任何修改)            │              │          │   (全新独立模块)           │
    ├───────────────────────────┤              │          ├───────────────────────────┤
    │                           │              │          │                           │
    │  ServiceFirmwareUpdate    │◄─────────────┘          │  ServiceLegacyFirmware-   │
    │                           │    版本 >= 限制          │  Update                   │
    │  firmwareUpdateStepInfo-  │                         │                           │
    │  Atom                     │                         │  legacyFirmwareUpdate-    │
    │                           │                         │  StepAtom                 │
    │  PageFirmwareUpdate-      │                         │                           │
    │  Install / InstallV2      │                         │  PageLegacyFirmware-      │
    │                           │                         │  Update                   │
    └───────────────────────────┘                         └───────────────────────────┘
              │                                                       │
              │                                                       │
              ▼                                                       ▼
    ┌───────────────────────────┐                         ┌───────────────────────────┐
    │   HardwareSDK             │◄────────────────────────│   HardwareSDK             │
    │   (共享)                   │                         │   (共享)                   │
    └───────────────────────────┘                         └───────────────────────────┘
```

### 1.2 文件结构

```
packages/
├── kit-bg/src/
│   ├── services/
│   │   ├── ServiceFirmwareUpdate/        # 现有服务（不修改）
│   │   │   └── ...
│   │   │
│   │   └── ServiceLegacyFirmwareUpdate/  # 新增：独立服务
│   │       ├── index.ts
│   │       ├── ServiceLegacyFirmwareUpdate.ts
│   │       ├── handlers/
│   │       │   ├── TouchFirmwareHandler.ts
│   │       │   ├── MiniFirmwareHandler.ts
│   │       │   └── ClassicFirmwareHandler.ts
│   │       ├── utils/
│   │       │   ├── legacyFirmwareDownloader.ts
│   │       │   └── bootloaderPreCheck.ts
│   │       └── types.ts
│   │
│   └── states/jotai/atoms/
│       ├── hardware.ts                   # 现有（不修改）
│       └── legacyFirmwareUpdate.ts       # 新增：独立状态
│
├── kit/src/views/
│   ├── FirmwareUpdate/                   # 现有（不修改）
│   │   └── ...
│   │
│   └── LegacyFirmwareUpdate/             # 新增：独立页面
│       ├── pages/
│       │   └── PageLegacyFirmwareUpdate.tsx
│       ├── components/
│       │   ├── LegacyUpdateStepIndicator.tsx
│       │   ├── LegacyUpdateCheckList.tsx
│       │   ├── LegacyUpdateProgress.tsx
│       │   ├── LegacyUpdateResult.tsx
│       │   └── MiniBootloaderGuide.tsx
│       ├── hooks/
│       │   └── useLegacyFirmwareUpdate.ts
│       └── router/
│           └── index.ts
│
└── shared/src/routes/
    ├── firmwareUpdate.ts                 # 现有（不修改）
    └── legacyFirmwareUpdate.ts           # 新增：独立路由
```

---

## 二、核心服务实现

### 2.1 ServiceLegacyFirmwareUpdate

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/ServiceLegacyFirmwareUpdate.ts
// ============================================================

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EDeviceType } from '@onekeyhq/shared/types/device';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import semver from 'semver';

import ServiceBase from '../ServiceBase';
import {
  legacyFirmwareUpdateStepAtom,
  legacyFirmwareUpdateProgressAtom,
  legacyFirmwareUpdateRunningAtom,
  ELegacyFirmwareUpdateSteps,
} from '../../states/jotai/atoms/legacyFirmwareUpdate';
import { TouchFirmwareHandler } from './handlers/TouchFirmwareHandler';
import { MiniFirmwareHandler } from './handlers/MiniFirmwareHandler';
import { ClassicFirmwareHandler } from './handlers/ClassicFirmwareHandler';
import { FIRMWARE_UPDATE_MIN_VERSION_ALLOWED } from '../ServiceFirmwareUpdate/firmwareUpdateConsts';

import type {
  ILegacyFlowCheckParams,
  ILegacyUpdateParams,
  ILegacyUpdateResult,
} from './types';
import type { ILegacyFirmwareUpdateStepInfo } from '../../states/jotai/atoms/legacyFirmwareUpdate';

@backgroundClass()
class ServiceLegacyFirmwareUpdate extends ServiceBase {
  
  // ==================== 处理器实例 ====================
  
  private touchHandler = new TouchFirmwareHandler();
  private miniHandler = new MiniFirmwareHandler();
  private classicHandler = new ClassicFirmwareHandler();
  
  // ==================== 公共方法 ====================
  
  /**
   * 判断是否应该使用遗留升级流程
   * 
   * 条件：
   * 1. Web 或 Extension 平台
   * 2. 设备版本低于最小限制
   */
  @backgroundMethod()
  shouldUseLegacyFlow(params: ILegacyFlowCheckParams): boolean {
    const { deviceType, firmwareVersion, bootloaderVersion } = params;
    
    // 条件 1: 仅 Web/Extension 平台
    if (!platformEnv.isWeb && !platformEnv.isExtension) {
      return false;
    }
    
    // 条件 2: Pro 设备无限制
    if (deviceType === EDeviceType.Pro) {
      return false;
    }
    
    // 条件 3: 检查版本限制
    const minVersion = FIRMWARE_UPDATE_MIN_VERSION_ALLOWED[deviceType];
    if (!minVersion) {
      return false;
    }

    // 版本低于最小限制时使用遗留流程
    const needsLegacy =
      (minVersion.firmware && firmwareVersion &&
        semver.lt(firmwareVersion, minVersion.firmware)) ||
      (minVersion.bootloader && bootloaderVersion &&
        semver.lt(bootloaderVersion, minVersion.bootloader));

    return needsLegacy;
  }
  
  /**
   * 开始遗留设备升级
   */
  @backgroundMethod()
  async startLegacyUpdate(params: ILegacyUpdateParams): Promise<ILegacyUpdateResult> {
    const { deviceType } = params;

    try {
      // 设置运行状态
      await legacyFirmwareUpdateRunningAtom.set(true);

      // 设置初始状态
      await this.setStep(ELegacyFirmwareUpdateSteps.preparing);

      // 根据设备类型选择处理器
      let result: ILegacyUpdateResult;

      switch (deviceType) {
        case EDeviceType.Touch:
          result = await this.touchHandler.update(params, this);
          break;

        case EDeviceType.Mini:
          result = await this.miniHandler.update(params, this);
          break;

        case EDeviceType.Classic:
        case EDeviceType.Classic1s:
        case EDeviceType.ClassicPure:
          result = await this.classicHandler.update(params, this);
          break;

        default:
          throw new Error(`Unsupported device type: ${deviceType}`);
      }

      // 设置完成状态
      await this.setStep(ELegacyFirmwareUpdateSteps.done);
      return result;
    } catch (error: any) {
      await this.setStep(ELegacyFirmwareUpdateSteps.error, {
        error: error.message || 'Unknown error',
      });
      throw error;
    } finally {
      await legacyFirmwareUpdateRunningAtom.set(false);
    }
  }
  
  // ==================== 状态管理 ====================

  @backgroundMethod()
  async setStep(
    step: ELegacyFirmwareUpdateSteps,
    payload?: ILegacyFirmwareUpdateStepInfo['payload'],
  ): Promise<void> {
    await legacyFirmwareUpdateStepAtom.set({
      step,
      payload,
    } as ILegacyFirmwareUpdateStepInfo);
  }

  @backgroundMethod()
  async setProgress(progress: number, message?: string): Promise<void> {
    await legacyFirmwareUpdateProgressAtom.set({ progress, message });
  }

  @backgroundMethod()
  async resetState(): Promise<void> {
    await legacyFirmwareUpdateStepAtom.set({
      step: ELegacyFirmwareUpdateSteps.idle,
      payload: undefined,
    });
    await legacyFirmwareUpdateProgressAtom.set({
      progress: 0,
      message: undefined,
    });
    await legacyFirmwareUpdateRunningAtom.set(false);
  }
  
  // ==================== SDK 访问 ====================
  
  async getSDKInstance() {
    return this.backgroundApi.serviceHardware.getSDKInstance();
  }
}

export default ServiceLegacyFirmwareUpdate;
```

### 2.2 类型定义

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/types.ts
// ============================================================

import type { EDeviceType } from '@onekeyhq/shared/types/device';

/**
 * 判断是否使用遗留流程的参数
 */
export interface ILegacyFlowCheckParams {
  deviceType: EDeviceType | string;
  firmwareVersion: string;
  bootloaderVersion: string;
}

/**
 * 遗留升级参数
 */
export interface ILegacyUpdateParams {
  deviceType: EDeviceType | string;
  connectId: string | undefined;
  currentFirmwareVersion: string;
  currentBootloaderVersion: string;
  targetFirmwareVersion?: string;
  isBootloaderMode?: boolean;
  shouldUpdateBle?: boolean;
}

/**
 * 遗留升级结果
 */
export interface ILegacyUpdateResult {
  success: boolean;
  deviceType: EDeviceType | string;
  needsBootloaderMode?: boolean;
  error?: string;
}
```

### 2.3 设备处理器

#### 2.3.1 Touch 设备处理器

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/TouchFirmwareHandler.ts
// ============================================================

import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';
import { downloadLegacyTouchFirmware } from '../utils/legacyFirmwareDownloader';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

export class TouchFirmwareHandler {
  /**
   * Touch 设备升级流程
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, currentFirmwareVersion } = params;

    // 1. 确定固件字段类型
    const firmwareField = this.determineFirmwareField(currentFirmwareVersion);
    await service.setProgress(10, `使用 ${firmwareField} 字段`);

    // 2. 下载遗留固件
    await service.setStep(ELegacyFirmwareUpdateSteps.downloadingFirmware, {
      firmwareField,
    });
    await service.setProgress(20, '下载固件中...');
    const firmwareBinary = await downloadLegacyTouchFirmware(firmwareField);
    await service.setProgress(50, '固件下载完成');

    // 3. 执行升级
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(60, '安装固件中...');

    const sdk = await service.getSDKInstance();
    const result = await sdk.firmwareUpdateV2(connectId, {
      updateType: 'firmware',
      platform: 'web',
      binary: firmwareBinary,
    });

    if (!result.success) {
      throw new Error(result.payload?.error || 'Firmware update failed');
    }

    await service.setProgress(100, '升级完成');

    return {
      success: true,
      deviceType: params.deviceType,
    };
  }

  /**
   * 确定使用哪个固件字段
   */
  private determineFirmwareField(version: string): 'firmware' | 'firmware-v2' {
    // 3.4.x 版本使用 firmware-v2
    if (version.startsWith('3.4.')) {
      return 'firmware-v2';
    }
    return 'firmware';
  }
}
```

#### 2.3.2 Mini 设备处理器

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/MiniFirmwareHandler.ts
// ============================================================

import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';
import { preCheckAndUpdateBootloader } from '../utils/bootloaderPreCheck';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

export class MiniFirmwareHandler {
  /**
   * Mini 设备升级流程
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, isBootloaderMode, targetFirmwareVersion, deviceType } =
      params;

    // 1. 检查 Bootloader 模式
    if (!isBootloaderMode) {
      await service.setStep(ELegacyFirmwareUpdateSteps.waitingBootloaderMode, {
        deviceType,
      });
      // 等待用户手动进入 Bootloader 模式
      // UI 层会显示引导，用户操作后重新进入流程
      return {
        success: false,
        needsBootloaderMode: true,
        deviceType,
      };
    }

    // 2. Bootloader 预检查和更新
    await service.setStep(ELegacyFirmwareUpdateSteps.checkingBootloader);
    await service.setProgress(10, '检查 Bootloader...');

    const sdk = await service.getSDKInstance();
    const bootloaderResult = await preCheckAndUpdateBootloader({
      sdk,
      connectId,
      targetFirmwareVersion,
      deviceType,
    });

    if (bootloaderResult.needsUpdate) {
      await service.setStep(ELegacyFirmwareUpdateSteps.updatingBootloader);
      await service.setProgress(20, '更新 Bootloader...');

      if (!bootloaderResult.updateSuccess) {
        throw new Error('Bootloader update failed');
      }

      // WebUSB: bootloader 更新后需要重新选择设备
      await service.setStep(ELegacyFirmwareUpdateSteps.requestDeviceReselect);

      // 等待设备重启
      await service.setProgress(30, '等待设备重启...');
      await this.waitDeviceRestart(15000);
    }

    // 3. 执行固件升级
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(50, '安装固件中...');

    const result = await sdk.firmwareUpdateV2(connectId, {
      updateType: 'firmware',
      platform: 'web',
    });

    if (!result.success) {
      throw new Error(result.payload?.error || 'Firmware update failed');
    }

    await service.setProgress(100, '升级完成');

    return {
      success: true,
      deviceType,
    };
  }

  private waitDeviceRestart(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

#### 2.3.3 Classic 设备处理器

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/ClassicFirmwareHandler.ts
// ============================================================

import { ELegacyFirmwareUpdateSteps } from '../../../states/jotai/atoms/legacyFirmwareUpdate';
import { preCheckAndUpdateBootloader } from '../utils/bootloaderPreCheck';

import type { ILegacyUpdateParams, ILegacyUpdateResult } from '../types';
import type ServiceLegacyFirmwareUpdate from '../ServiceLegacyFirmwareUpdate';

export class ClassicFirmwareHandler {
  /**
   * Classic 系列设备升级流程
   * 适用于: Classic, Classic1s, ClassicPure
   */
  async update(
    params: ILegacyUpdateParams,
    service: ServiceLegacyFirmwareUpdate,
  ): Promise<ILegacyUpdateResult> {
    const { connectId, targetFirmwareVersion, deviceType } = params;
    const sdk = await service.getSDKInstance();

    // 1. Bootloader 预检查和更新
    await service.setStep(ELegacyFirmwareUpdateSteps.checkingBootloader);
    await service.setProgress(10, '检查 Bootloader...');

    const bootloaderResult = await preCheckAndUpdateBootloader({
      sdk,
      connectId,
      targetFirmwareVersion,
      deviceType,
    });

    if (bootloaderResult.needsUpdate) {
      await service.setStep(ELegacyFirmwareUpdateSteps.updatingBootloader);
      await service.setProgress(20, '更新 Bootloader...');

      if (!bootloaderResult.updateSuccess) {
        throw new Error('Bootloader update failed');
      }

      // WebUSB: bootloader 更新后需要重新选择设备
      await service.setStep(ELegacyFirmwareUpdateSteps.requestDeviceReselect);

      // 等待设备重启
      await service.setProgress(40, '等待设备重启...');
      await this.waitDeviceRestart(15000);
    }

    // 2. 执行固件升级
    await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
      phase: 'firmware',
    });
    await service.setProgress(50, '安装固件中...');

    const firmwareResult = await sdk.firmwareUpdateV2(connectId, {
      updateType: 'firmware',
      platform: 'web',
    });

    if (!firmwareResult.success) {
      throw new Error(
        firmwareResult.payload?.error || 'Firmware update failed',
      );
    }

    // 3. (可选) BLE 升级
    if (params.shouldUpdateBle) {
      await service.setStep(ELegacyFirmwareUpdateSteps.installingFirmware, {
        phase: 'ble',
      });
      await service.setProgress(80, '更新蓝牙固件...');

      const bleResult = await sdk.firmwareUpdateV2(connectId, {
        updateType: 'ble',
        platform: 'web',
      });

      if (!bleResult.success) {
        console.warn('BLE update failed:', bleResult.payload?.error);
        // BLE 失败不阻断主流程
      }
    }

    await service.setProgress(100, '升级完成');

    return {
      success: true,
      deviceType,
    };
  }

  private waitDeviceRestart(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 三、工具函数

### 3.1 遗留固件下载

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/legacyFirmwareDownloader.ts
// ============================================================

import axios from 'axios';

const TOUCH_FIRMWARE_BASE_URL = 'https://data.onekey.so/touch';
const DOWNLOAD_TIMEOUT = 120000; // 2分钟

/**
 * 下载 Touch 遗留固件
 */
export async function downloadLegacyTouchFirmware(
  field: 'firmware' | 'firmware-v2' | 'bootloader'
): Promise<ArrayBuffer> {
  const timestamp = Date.now();
  const url = `${TOUCH_FIRMWARE_BASE_URL}/${field}.bin?t=${timestamp}`;
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT,
  });
  
  return response.data;
}
```

### 3.2 Bootloader 预检查

```typescript
// ============================================================
// 文件: packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/bootloaderPreCheck.ts
// ============================================================

import { EDeviceType } from '@onekeyhq/shared/types/device';

interface IBootloaderPreCheckParams {
  sdk: any;
  connectId: string | undefined;
  targetFirmwareVersion: string;
  deviceType: string;
}

interface IBootloaderPreCheckResult {
  needsUpdate: boolean;
  updateSuccess: boolean;
}

const NEEDS_PRECHECK_DEVICES = [
  EDeviceType.Classic,
  EDeviceType.Classic1s,
  EDeviceType.ClassicPure,
  EDeviceType.Mini,
];

/**
 * Bootloader 预检查和更新
 */
export async function preCheckAndUpdateBootloader(
  params: IBootloaderPreCheckParams
): Promise<IBootloaderPreCheckResult> {
  const { sdk, connectId, targetFirmwareVersion, deviceType } = params;
  
  // 检查是否需要预检查
  if (!NEEDS_PRECHECK_DEVICES.includes(deviceType as EDeviceType)) {
    return { needsUpdate: false, updateSuccess: true };
  }
  
  // 调用 SDK 检查
  const checkResult = await sdk.checkBootloaderRelease(connectId, {
    willUpdateFirmwareVersion: targetFirmwareVersion,
  });
  
  if (!checkResult.success || !checkResult.payload?.shouldUpdate) {
    return { needsUpdate: false, updateSuccess: true };
  }
  
  // 需要更新 Bootloader
  const updateResult = await sdk.firmwareUpdateV2(connectId, {
    updateType: 'firmware',
    platform: 'web',
    isUpdateBootloader: true,
  });
  
  return {
    needsUpdate: true,
    updateSuccess: updateResult.success,
  };
}
```

---

## 四、状态管理

### 4.1 Atom 名称注册

```typescript
// ============================================================
// 文件: packages/kit-bg/src/states/jotai/atomNames.ts
// 修改: 在 EAtomNames 枚举中添加
// ============================================================

export enum EAtomNames {
  // ... 现有名称 ...

  // Legacy Firmware Update (新增)
  legacyFirmwareUpdateStepAtom = 'legacyFirmwareUpdateStepAtom',
  legacyFirmwareUpdateProgressAtom = 'legacyFirmwareUpdateProgressAtom',
  legacyFirmwareUpdateRunningAtom = 'legacyFirmwareUpdateRunningAtom',
}
```

### 4.2 独立的 Jotai Atoms

```typescript
// ============================================================
// 文件: packages/kit-bg/src/states/jotai/atoms/legacyFirmwareUpdate.ts
// ============================================================

import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// ==================== 类型定义 ====================

/**
 * Legacy 升级步骤枚举
 * 复用部分现有步骤名称以保持一致性
 */
export enum ELegacyFirmwareUpdateSteps {
  // 基础步骤
  idle = 'idle',
  preparing = 'preparing',
  error = 'error',

  // Mini 专用 - 手动进入 bootloader 模式
  waitingBootloaderMode = 'waitingBootloaderMode',

  // Bootloader 检查和更新
  checkingBootloader = 'checkingBootloader',
  updatingBootloader = 'updatingBootloader',

  // 固件下载和安装
  downloadingFirmware = 'downloadingFirmware',
  installingFirmware = 'installingFirmware',

  // WebUSB 重新选择设备 (bootloader 模式 PID 变化)
  requestDeviceReselect = 'requestDeviceReselect',

  // 完成
  done = 'done',
}

export type ILegacyFirmwareUpdateStepInfo =
  | {
      step: ELegacyFirmwareUpdateSteps.idle;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.preparing;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.error;
      payload: {
        error: IOneKeyError | string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.waitingBootloaderMode;
      payload: {
        deviceType: string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.checkingBootloader;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.updatingBootloader;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.downloadingFirmware;
      payload: {
        firmwareField?: string;
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.installingFirmware;
      payload: {
        phase?: 'firmware' | 'ble';
      };
    }
  | {
      step: ELegacyFirmwareUpdateSteps.requestDeviceReselect;
      payload: undefined;
    }
  | {
      step: ELegacyFirmwareUpdateSteps.done;
      payload?: {
        needOnboarding?: boolean;
      };
    };

export interface ILegacyFirmwareUpdateProgress {
  progress: number; // 0-100
  message?: string;
}

// ==================== Atoms ====================

/**
 * 遗留升级步骤状态
 */
export const {
  target: legacyFirmwareUpdateStepAtom,
  use: useLegacyFirmwareUpdateStepAtom,
} = globalAtom<ILegacyFirmwareUpdateStepInfo>({
  initialValue: {
    step: ELegacyFirmwareUpdateSteps.idle,
    payload: undefined,
  },
  name: EAtomNames.legacyFirmwareUpdateStepAtom,
});

/**
 * 遗留升级进度
 */
export const {
  target: legacyFirmwareUpdateProgressAtom,
  use: useLegacyFirmwareUpdateProgressAtom,
} = globalAtom<ILegacyFirmwareUpdateProgress>({
  initialValue: {
    progress: 0,
    message: undefined,
  },
  name: EAtomNames.legacyFirmwareUpdateProgressAtom,
});

/**
 * 是否正在运行遗留升级
 */
export const {
  target: legacyFirmwareUpdateRunningAtom,
  use: useLegacyFirmwareUpdateRunningAtom,
} = globalAtom<boolean>({
  initialValue: false,
  name: EAtomNames.legacyFirmwareUpdateRunningAtom,
});
```

---

## 五、页面组件

### 5.1 主页面

```typescript
// ============================================================
// 文件: packages/kit/src/views/LegacyFirmwareUpdate/pages/PageLegacyFirmwareUpdate.tsx
// ============================================================

import { useCallback, useEffect } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import {
  ELegacyFirmwareUpdateSteps,
  useLegacyFirmwareUpdateProgressAtom,
  useLegacyFirmwareUpdateStepAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EModalLegacyFirmwareUpdateRoutes,
  type IModalLegacyFirmwareUpdateParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { LegacyUpdateCheckList } from '../components/LegacyUpdateCheckList';
import { LegacyUpdateProgress } from '../components/LegacyUpdateProgress';
import { LegacyUpdateResult } from '../components/LegacyUpdateResult';
import { LegacyUpdateStepIndicator } from '../components/LegacyUpdateStepIndicator';
import { MiniBootloaderGuide } from '../components/MiniBootloaderGuide';

function PageLegacyFirmwareUpdate() {
  const route = useAppRoute<
    IModalLegacyFirmwareUpdateParamList,
    EModalLegacyFirmwareUpdateRoutes.LegacyUpdate
  >();
  const {
    deviceType,
    connectId,
    currentFirmwareVersion,
    currentBootloaderVersion,
    isBootloaderMode,
  } = route.params;

  const [stepInfo] = useLegacyFirmwareUpdateStepAtom();
  const [progress] = useLegacyFirmwareUpdateProgressAtom();

  // 组件卸载时重置状态
  useEffect(() => {
    return () => {
      void backgroundApiProxy.serviceLegacyFirmwareUpdate.resetState();
    };
  }, []);

  const handleStartUpdate = useCallback(async () => {
    await backgroundApiProxy.serviceLegacyFirmwareUpdate.startLegacyUpdate({
      deviceType,
      connectId,
      currentFirmwareVersion,
      currentBootloaderVersion,
      isBootloaderMode,
    });
  }, [
    deviceType,
    connectId,
    currentFirmwareVersion,
    currentBootloaderVersion,
    isBootloaderMode,
  ]);

  // 渲染当前步骤的内容
  const renderContent = () => {
    switch (stepInfo.step) {
      case ELegacyFirmwareUpdateSteps.idle:
      case ELegacyFirmwareUpdateSteps.preparing:
        return (
          <LegacyUpdateCheckList
            deviceType={deviceType}
            onStartUpdate={handleStartUpdate}
          />
        );

      case ELegacyFirmwareUpdateSteps.waitingBootloaderMode:
        return <MiniBootloaderGuide onRetry={handleStartUpdate} />;

      case ELegacyFirmwareUpdateSteps.checkingBootloader:
      case ELegacyFirmwareUpdateSteps.updatingBootloader:
      case ELegacyFirmwareUpdateSteps.downloadingFirmware:
      case ELegacyFirmwareUpdateSteps.installingFirmware:
      case ELegacyFirmwareUpdateSteps.requestDeviceReselect:
        return (
          <LegacyUpdateProgress
            step={stepInfo.step}
            progress={progress.progress}
            message={progress.message}
          />
        );

      case ELegacyFirmwareUpdateSteps.done:
        return <LegacyUpdateResult success />;

      case ELegacyFirmwareUpdateSteps.error:
        return (
          <LegacyUpdateResult
            success={false}
            error={
              stepInfo.step === ELegacyFirmwareUpdateSteps.error
                ? stepInfo.payload?.error
                : undefined
            }
            onRetry={handleStartUpdate}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Page>
      <Page.Header title="固件升级" />
      <Page.Body>
        <Stack space="$4" p="$4">
          <LegacyUpdateStepIndicator currentStep={stepInfo.step} />
          {renderContent()}
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default PageLegacyFirmwareUpdate;
```

### 5.2 Mini Bootloader 引导组件

```typescript
// ============================================================
// 文件: packages/kit/src/views/LegacyFirmwareUpdate/components/MiniBootloaderGuide.tsx
// ============================================================

import { Alert, Button, Stack, Text, YStack } from '@onekeyhq/components';

interface IMiniBootloaderGuideProps {
  onRetry: () => void;
}

export function MiniBootloaderGuide({ onRetry }: IMiniBootloaderGuideProps) {
  const steps = [
    '断开设备 USB 连接',
    '按住设备上的按钮不放',
    '保持按住按钮，将 USB 连接到电脑',
    '等待屏幕显示 "Bootloader" 字样后松开按钮',
  ];
  
  return (
    <YStack space="$4">
      <Alert type="warning">
        <Alert.Title>需要手动进入 Bootloader 模式</Alert.Title>
        <Alert.Description>
          Mini 设备需要手动进入 Bootloader 模式才能升级固件。
        </Alert.Description>
      </Alert>
      
      <YStack space="$2" p="$4" bg="$bgSubdued" borderRadius="$2">
        <Text fontWeight="$semibold">请按以下步骤操作：</Text>
        <Stack space="$2" mt="$2">
          {steps.map((step, index) => (
            <Text key={index} color="$textSubdued">
              {index + 1}. {step}
            </Text>
          ))}
        </Stack>
      </YStack>
      
      <Button onPress={onRetry}>
        已进入 Bootloader 模式，继续升级
      </Button>
    </YStack>
  );
}
```

---

## 六、路由配置

### 6.1 路由定义

```typescript
// ============================================================
// 文件: packages/shared/src/routes/legacyFirmwareUpdate.ts
// ============================================================

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

### 6.2 入口集成

```typescript
// ============================================================
// 文件: packages/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions.tsx
// 修改: 添加约 20 行代码
// ============================================================

// 在 openFirmwareUpdateModal 或类似方法中添加：

const openFirmwareUpdateModal = useCallback(async (params) => {
  const result = await backgroundApiProxy.serviceFirmwareUpdate.checkAllFirmwareRelease(params);
  
  // ========== 新增开始 ==========
  // 判断是否使用遗留升级流程
  const useLegacyFlow = backgroundApiProxy.serviceLegacyFirmwareUpdate.shouldUseLegacyFlow({
    deviceType: result.deviceType,
    firmwareVersion: result.updateInfos?.firmware?.fromVersion || '',
    bootloaderVersion: result.updateInfos?.bootloader?.fromVersion || '',
  });
  
  if (useLegacyFlow) {
    navigation.push(EModalLegacyFirmwareUpdateRoutes.LegacyUpdate, {
      connectId: params.connectId,
      deviceType: result.deviceType,
      currentFirmwareVersion: result.updateInfos?.firmware?.fromVersion || '',
      currentBootloaderVersion: result.updateInfos?.bootloader?.fromVersion || '',
      isBootloaderMode: result.isBootloaderMode,
    });
    return;
  }
  // ========== 新增结束 ==========
  
  // 原有逻辑保持不变
  // ...
}, [navigation]);
```

---

## 七、文件清单总结

### 新增文件（约 1600 行）

| 文件路径 | 说明 | 行数 |
|---------|------|------|
| **服务层** | | |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/index.ts` | 服务入口导出 | 20 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/ServiceLegacyFirmwareUpdate.ts` | 主服务类 | 220 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/types.ts` | 类型定义 | 50 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/TouchFirmwareHandler.ts` | Touch 处理器 | 80 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/MiniFirmwareHandler.ts` | Mini 处理器 | 100 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/ClassicFirmwareHandler.ts` | Classic 处理器 | 110 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/legacyFirmwareDownloader.ts` | 固件下载 | 30 |
| `kit-bg/src/services/ServiceLegacyFirmwareUpdate/utils/bootloaderPreCheck.ts` | Bootloader 检查 | 60 |
| **状态管理** | | |
| `kit-bg/src/states/jotai/atoms/legacyFirmwareUpdate.ts` | 独立 Jotai atoms | 120 |
| **页面层** | | |
| `kit/src/views/LegacyFirmwareUpdate/pages/PageLegacyFirmwareUpdate.tsx` | 主页面 | 120 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateStepIndicator.tsx` | 步骤指示器 | 60 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateCheckList.tsx` | 升级前检查清单 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateProgress.tsx` | 进度显示 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateResult.tsx` | 结果显示 | 80 |
| `kit/src/views/LegacyFirmwareUpdate/components/MiniBootloaderGuide.tsx` | Mini 引导 | 70 |
| `kit/src/views/LegacyFirmwareUpdate/hooks/useLegacyFirmwareUpdate.ts` | 业务 Hook | 80 |
| `kit/src/views/LegacyFirmwareUpdate/router/index.ts` | 路由配置 | 30 |
| **路由** | | |
| `shared/src/routes/legacyFirmwareUpdate.ts` | 路由定义 | 25 |

### 修改文件（约 35 行）

| 文件路径 | 修改内容 | 改动量 |
|---------|---------|--------|
| `kit-bg/src/states/jotai/atomNames.ts` | 添加 atom 名称枚举 | +5 行 |
| `kit-bg/src/states/jotai/atoms/index.ts` | 导出新 atoms | +3 行 |
| `kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions.tsx` | 添加流程判断逻辑 | +20 行 |
| `shared/src/routes/index.ts` | 导出新路由 | +2 行 |
| `kit-bg/src/BackgroundApiBase.ts` (或相关注册文件) | 注册新服务 | +5 行 |

### 服务注册示例

```typescript
// ============================================================
// 文件: packages/kit-bg/src/BackgroundApiBase.ts (或相关服务注册文件)
// 修改: 注册新服务
// ============================================================

import ServiceLegacyFirmwareUpdate from './services/ServiceLegacyFirmwareUpdate';

// 在 services 对象中添加:
serviceLegacyFirmwareUpdate: ServiceLegacyFirmwareUpdate;

// 在初始化中添加:
this.serviceLegacyFirmwareUpdate = new ServiceLegacyFirmwareUpdate({
  backgroundApi: this,
});
```
