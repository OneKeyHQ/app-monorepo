# Ralph Fix Plan - Legacy Firmware Update UI 组件

## High Priority

### UI 组件创建
- [x] 创建 `packages/kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateStepIndicator.tsx` - 步骤指示器组件，根据 ELegacyFirmwareUpdateSteps 枚举显示当前升级进度（idle -> preparing -> downloading -> installing -> done）
- [x] 创建 `packages/kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateCheckList.tsx` - 升级前检查清单组件，显示设备类型、当前固件版本、目标版本信息，包含"开始升级"按钮
- [x] 创建 `packages/kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateProgress.tsx` - 升级进度显示组件，包含进度条、当前步骤文字描述，支持 checkingBootloader/updatingBootloader/downloadingFirmware/installingFirmware/requestDeviceReselect 等状态
- [x] 创建 `packages/kit/src/views/LegacyFirmwareUpdate/components/LegacyUpdateResult.tsx` - 升级结果组件，成功时显示完成信息，失败时显示错误详情和重试按钮

## Medium Priority

### 集成与验证
- [x] 更新 `PageLegacyFirmwareUpdate.tsx` 引入新创建的 4 个组件，完善页面渲染逻辑
- [x] 运行 `yarn lint` 验证所有新增代码无 lint 错误
- [x] 运行 `yarn tsc:only` 验证 TypeScript 类型正确

## Completed

### 服务层 (已完成)
- [x] ServiceLegacyFirmwareUpdate 主服务
- [x] TouchFirmwareHandler 处理器
- [x] MiniFirmwareHandler 处理器
- [x] ClassicFirmwareHandler 处理器
- [x] legacyFirmwareDownloader 工具
- [x] bootloaderPreCheck 工具
- [x] types.ts 类型定义

### 状态管理 (已完成)
- [x] legacyFirmwareUpdate.ts atoms

### 路由配置 (已完成)
- [x] legacyFirmwareUpdate.ts 路由定义
- [x] router/index.ts 路由注册

### 页面基础 (已完成)
- [x] PageLegacyFirmwareUpdate.tsx 主页面框架
- [x] MiniBootloaderModeGuide.tsx 组件
- [x] LegacyFirmwareUpdateExitPrevent.tsx 组件
- [x] WebUsbDeviceReselectPrompt.tsx 组件

### UI 组件 (已完成)
- [x] LegacyUpdateStepIndicator.tsx 步骤指示器
- [x] LegacyUpdateCheckList.tsx 升级前检查清单
- [x] LegacyUpdateProgress.tsx 升级进度显示
- [x] LegacyUpdateResult.tsx 升级结果

### 集成 (已完成)
- [x] BackgroundApi 服务注册
- [x] useFirmwareUpdateActions 入口判断

### UI 动画优化 (已完成)
- [x] LegacyUpdateStepIndicator - 步骤切换动画 (spring scale + 进度条填充动画)
- [x] LegacyUpdateProgress - 平滑进度过渡 (useSmoothProgress hook + animated prop)
- [x] LegacyUpdateResult - 成功/失败入场动画 (scale + fade + slide)
- [x] LegacyUpdateCheckList - 卡片入场动画 (fade + slide)
- [x] MiniBootloaderModeGuide - 分层入场动画
- [x] WebUsbDeviceReselectPrompt - 统一入场动画

## Notes

- 组件需要使用 `@onekeyhq/components` 中的 UI 组件
- 参考 `page-specs.md` 中的组件设计规格
- 使用 `useLegacyFirmwareUpdateStepAtom` 和 `useLegacyFirmwareUpdateProgressAtom` 获取状态
- 保持与现有 FirmwareUpdate 页面的视觉风格一致
