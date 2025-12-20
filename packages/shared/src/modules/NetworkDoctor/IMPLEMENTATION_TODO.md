# Network Doctor Implementation TODO

## 项目概述

从 `sni-expo-demo` 项目迁移 Network Doctor 网络诊断功能到 OneKey monorepo。

**源代码位置**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/`
**目标位置**: `@x-app-monorepo/packages/shared/src/modules/NetworkDoctor/`

**关键要求**:
- 1:1 按照 sni-expo-demo 的实现和目录结构完成
- 由于 monorepo 是多端编译,需要将 native module 相关的实现隐藏在 `.native.ts` 文件中
- 确保 tree shaking 在编译阶段能正确工作

---

## 架构决策 (DECISION REQUIRED)

### 🤔 方案选择

在开始实施前,需要明确架构方案:

#### **方案 A: 严格平台分离** (推荐 ✅)

```
NetworkDoctor/
├── types.ts                    # 纯类型定义,无任何 import
├── config.ts                   # 配置管理,无 native import
├── NetworkDoctor.native.ts     # 核心诊断类 (所有 native module 在这里)
├── doctor.native.ts            # 函数式 API
├── examples.native.ts          # 使用示例
├── index.ts                    # 通用入口 (只导出类型)
├── index.native.ts             # Native 平台入口 (导出完整功能)
├── index.web.ts                # Web 平台 stub (可选)
├── index.desktop.ts            # Desktop 平台 stub (可选)
├── README.md                   # 文档
└── IMPLEMENTATION_TODO.md      # 本文件
```

**优点**:
- ✅ 完美支持 tree shaking
- ✅ Web/Desktop/Ext 端编译不会引入 native modules
- ✅ 符合 monorepo 的架构规范
- ✅ 类型定义可以跨平台共享

**缺点**:
- ⚠️ 文件结构与 sni-expo-demo 略有不同 (增加了 `.native` 后缀)

---

#### **方案 B: 1:1 完全复制** (不推荐 ⚠️)

```
NetworkDoctor/
├── types.ts                    # 从 sni-expo-demo 复制
├── config.ts                   # 从 sni-expo-demo 复制
├── NetworkDoctor.ts            # 从 sni-expo-demo 复制 (包含 native imports)
├── doctor.ts                   # 从 sni-expo-demo 复制
├── examples.ts                 # 从 sni-expo-demo 复制
├── index.ts                    # 从 sni-expo-demo 复制
├── README.md                   # 从 sni-expo-demo 复制
└── IMPLEMENTATION_TODO.md      # 本文件
```

**优点**:
- ✅ 与源项目结构 100% 一致
- ✅ 迁移简单直接

**缺点**:
- ❌ Web/Desktop/Ext 端编译会失败 (因为 import 了 native modules)
- ❌ 无法实现 tree shaking
- ❌ 不符合 monorepo 的跨平台架构规范
- ❌ 需要后期重构

---

### ✅ **建议采用方案 A**

理由:
1. OneKey monorepo 是多端编译项目,必须严格区分平台代码
2. 方案 A 只是在文件名上增加 `.native` 后缀,代码内容完全一致
3. 符合现有代码库的最佳实践 (参考 `@onekeyhq/shared/src/platformEnv`)

---

## 依赖检查

### Native Dependencies (需要安装)

在开始实施前,确认以下 native modules 已安装:

```bash
yarn workspace @onekeyhq/shared add @react-native-community/netinfo
yarn workspace @onekeyhq/shared add react-native-dns-lookup
yarn workspace @onekeyhq/shared add react-native-network-logger
yarn workspace @onekeyhq/shared add react-native-ping
yarn workspace @onekeyhq/shared add react-native-tcp-socket
yarn workspace @onekeyhq/shared add react-native-network-info
```

### 其他依赖

```bash
yarn workspace @onekeyhq/shared add axios  # 如果尚未安装
```

---

## 实施任务清单

### Phase 1: 准备工作

- [ ] **Task 1.1**: 确认架构方案 (方案 A 或方案 B)
- [ ] **Task 1.2**: 检查并安装所有必需的依赖
- [ ] **Task 1.3**: 在 iOS 项目中执行 `pod install` (如果新增了 native modules)
- [ ] **Task 1.4**: 在 Android 项目中同步 gradle 依赖

### Phase 2: 核心文件迁移 (方案 A)

#### 2.1 类型定义

- [ ] **Task 2.1.1**: 创建 `types.ts`
  - 从 `sni-expo-demo/src/network-doctor/types.ts` 复制
  - 确保只包含类型定义,无任何 import
  - 验证所有导出的类型都是纯 TypeScript 类型

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/types.ts`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/types.ts`

#### 2.2 配置管理

- [ ] **Task 2.2.1**: 创建 `config.ts`
  - 从 `sni-expo-demo/src/network-doctor/config.ts` 复制
  - 导入 `types.ts` 中的类型
  - 确保无 native module import
  - 保留所有默认配置和工具函数

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/config.ts`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/config.ts`

#### 2.3 核心诊断类

- [ ] **Task 2.3.1**: 创建 `NetworkDoctor.native.ts`
  - 从 `sni-expo-demo/src/network-doctor/NetworkDoctor.ts` 复制
  - **重要**: 文件重命名为 `.native.ts` 后缀
  - 保留所有 native module imports
  - 导入 `types.ts` 和 `config.ts`
  - 确保所有私有方法和公共方法逻辑完整

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/NetworkDoctor.ts`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/NetworkDoctor.native.ts`

**关键点**:
- ✅ 所有 native module 的 import 都在这个文件中
- ✅ 这个文件只会在 native 平台 (iOS/Android) 编译时被引入
- ✅ Web/Desktop/Ext 端不会编译这个文件

#### 2.4 函数式 API

- [ ] **Task 2.4.1**: 创建 `doctor.native.ts`
  - 从 `sni-expo-demo/src/network-doctor/doctor.ts` 复制
  - **重要**: 文件重命名为 `.native.ts` 后缀
  - 导入 `NetworkDoctor.native.ts`
  - 导入 `types.ts`
  - 确保 `runNetworkDoctor` 函数完整

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/doctor.ts`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/doctor.native.ts`

#### 2.5 使用示例

- [ ] **Task 2.5.1**: 创建 `examples.native.ts`
  - 从 `sni-expo-demo/src/network-doctor/examples.ts` 复制
  - **重要**: 文件重命名为 `.native.ts` 后缀
  - 更新 import 路径,指向 monorepo 中的文件
  - 确保所有示例代码可运行

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/examples.ts`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/examples.native.ts`

### Phase 3: 入口文件设置

#### 3.1 通用入口

- [ ] **Task 3.1.1**: 创建 `index.ts`
  - **只导出类型定义**
  - 不导入任何 native 相关的实现
  - 供 Web/Desktop/Ext 端使用

**内容示例**:
```typescript
/**
 * Network Doctor - Universal Entry
 *
 * This file only exports types for non-native platforms.
 * For native implementation, use index.native.ts
 */

export * from './types';
```

**目标文件**: `packages/shared/src/modules/NetworkDoctor/index.ts`

#### 3.2 Native 入口

- [ ] **Task 3.2.1**: 更新 `index.native.ts`
  - 导出所有类型 (`types.ts`)
  - 导出核心类 (`NetworkDoctor.native.ts`)
  - 导出函数式 API (`doctor.native.ts`)
  - 导出配置相关 (`config.ts`)

**内容示例**:
```typescript
/**
 * Network Doctor - Native Entry
 *
 * Complete implementation for iOS/Android platforms.
 */

export * from './types';
export * from './config';
export { NetworkDoctor } from './NetworkDoctor.native';
export { runNetworkDoctor } from './doctor.native';
```

**目标文件**: `packages/shared/src/modules/NetworkDoctor/index.native.ts`

#### 3.3 其他平台 Stub (可选)

- [ ] **Task 3.3.1**: 创建 `index.web.ts` (可选)
  - 提供 Web 平台的 stub 实现
  - 或者抛出友好的错误提示

**内容示例**:
```typescript
/**
 * Network Doctor - Web Stub
 *
 * Network diagnostics are not supported on web platform.
 */

export * from './types';

export function runNetworkDoctor(): Promise<any> {
  throw new Error('Network Doctor is only available on native platforms (iOS/Android)');
}
```

**目标文件**: `packages/shared/src/modules/NetworkDoctor/index.web.ts`

- [ ] **Task 3.3.2**: 创建 `index.desktop.ts` (可选)
- [ ] **Task 3.3.3**: 创建 `index.ext.ts` (可选)

### Phase 4: 文档迁移

- [ ] **Task 4.1**: 复制并更新 `README.md`
  - 从 `sni-expo-demo/src/network-doctor/README.md` 复制
  - 更新 import 路径,使用 `@onekeyhq/shared` 的路径
  - 更新示例代码,符合 OneKey 的代码风格
  - 添加 monorepo 特定的注意事项

**源文件**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/README.md`
**目标文件**: `packages/shared/src/modules/NetworkDoctor/README.md`

**需要更新的内容**:
- ✅ Import 路径: `from '@/network-doctor'` → `from '@onekeyhq/shared/src/modules/NetworkDoctor'`
- ✅ 添加平台限制说明: "仅支持 Native 平台 (iOS/Android)"
- ✅ 添加使用前提: "确保从 `.native.ts` 文件中导入"

### Phase 5: 代码验证

#### 5.1 TypeScript 检查

- [ ] **Task 5.1.1**: 运行 TypeScript 编译检查
  ```bash
  yarn tsc:only
  ```
  - 确保无 TypeScript 错误
  - 检查是否有循环依赖
  - 验证类型导入导出正确

#### 5.2 Linting 检查

- [ ] **Task 5.2.1**: 运行 ESLint 检查
  ```bash
  yarn lint
  ```
  - 确保代码符合项目规范
  - 修复所有 linting 错误和警告
  - 检查 import 顺序是否正确

#### 5.3 Import 层级验证

- [ ] **Task 5.3.1**: 验证 import 层级规则
  - ✅ `types.ts` - 不导入任何 OneKey 包
  - ✅ `config.ts` - 只导入 `types.ts`
  - ✅ `NetworkDoctor.native.ts` - 可导入 `types.ts`, `config.ts`, native modules
  - ✅ `doctor.native.ts` - 可导入 `types.ts`, `NetworkDoctor.native.ts`
  - ✅ `index.native.ts` - 可导入所有本地文件

**重要**: 不得违反 monorepo 的 import 层级规则 (参考 `CLAUDE.md`)

### Phase 6: 功能测试

#### 6.1 iOS 测试

- [ ] **Task 6.1.1**: 在 Gallery 页面添加测试入口
  - 位置: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/NetworkDoctor.tsx`
  - 添加测试按钮
  - 调用 `runNetworkDoctor` 并显示结果

- [ ] **Task 6.1.2**: 在 iOS 模拟器上测试
  ```bash
  yarn app:ios
  ```
  - 打开 Gallery → Network Doctor
  - 点击测试按钮
  - 验证所有诊断项都正常运行
  - 检查控制台日志输出

- [ ] **Task 6.1.3**: 测试所有诊断功能
  - ✅ NetInfo 检查
  - ✅ DNS 解析
  - ✅ TCP 连接
  - ✅ TLS 握手
  - ✅ Ping 测试
  - ✅ HTTP 健康检查
  - ✅ 网络日志收集

#### 6.2 Android 测试

- [ ] **Task 6.2.1**: 在 Android 模拟器上测试
  ```bash
  yarn app:android
  ```
  - 执行与 iOS 相同的测试流程
  - 验证所有功能正常

#### 6.3 非 Native 平台验证

- [ ] **Task 6.3.1**: 验证 Web 端编译
  ```bash
  yarn app:web
  ```
  - 确保编译成功
  - 验证不会引入 native modules
  - 如果有使用 Network Doctor 的代码,确保有平台检测

- [ ] **Task 6.3.2**: 验证 Desktop 端编译
  ```bash
  yarn app:desktop
  ```
  - 确保编译成功

- [ ] **Task 6.3.3**: 验证 Extension 端编译
  ```bash
  yarn app:ext
  ```
  - 确保编译成功

### Phase 7: 集成到应用

#### 7.1 更新 Gallery 示例

- [ ] **Task 7.1.1**: 更新 `NetworkDoctor.tsx` 组件
  - 文件: `packages/kit/src/views/Developer/pages/Gallery/Components/stories/NetworkDoctor.tsx`
  - 导入正确的 API
  - 实现完整的诊断功能展示
  - 显示诊断报告的所有字段

#### 7.2 添加使用文档

- [ ] **Task 7.2.1**: 在 `CLAUDE.md` 中添加 Network Doctor 使用说明
  - 说明只能在 Native 平台使用
  - 提供基础使用示例
  - 说明如何解读诊断报告

### Phase 8: 性能优化

- [ ] **Task 8.1**: 检查 bundle size 影响
  - 运行 `yarn app:native-bundle`
  - 对比添加前后的 bundle 大小
  - 确保 tree shaking 正常工作

- [ ] **Task 8.2**: 优化诊断速度
  - 分析诊断耗时
  - 优化超时配置
  - 考虑并行化测试

### Phase 9: 文档完善

- [ ] **Task 9.1**: 添加中文文档
  - 创建 `README.zh-CN.md`
  - 翻译所有使用说明和示例

- [ ] **Task 9.2**: 添加 MIGRATION_GUIDE.md
  - 如果原项目有迁移指南,同步过来
  - 说明与原项目的差异

- [ ] **Task 9.3**: 添加 API 文档注释
  - 确保所有公共 API 都有 TSDoc 注释
  - 提供使用示例

### Phase 10: 代码审查

- [ ] **Task 10.1**: 自我审查
  - 检查代码质量
  - 确保符合 OneKey 代码规范
  - 移除不必要的注释和 console.log

- [ ] **Task 10.2**: 准备 PR
  - 写清晰的 commit message
  - 准备 PR 描述
  - 添加测试截图

---

## 文件清单

### 最终文件结构 (方案 A)

```
packages/shared/src/modules/NetworkDoctor/
├── types.ts                    # ✅ 类型定义 (无 import)
├── config.ts                   # ✅ 配置管理 (无 native import)
├── NetworkDoctor.native.ts     # ✅ 核心诊断类 (包含所有 native imports)
├── doctor.native.ts            # ✅ 函数式 API
├── examples.native.ts          # ✅ 使用示例
├── index.ts                    # ✅ 通用入口 (只导出类型)
├── index.native.ts             # ✅ Native 入口 (完整功能)
├── index.web.ts                # 🔲 Web stub (可选)
├── index.desktop.ts            # 🔲 Desktop stub (可选)
├── index.ext.ts                # 🔲 Extension stub (可选)
├── README.md                   # ✅ 英文文档
├── README.zh-CN.md             # 🔲 中文文档 (可选)
├── MIGRATION_GUIDE.md          # 🔲 迁移指南 (如果原项目有)
└── IMPLEMENTATION_TODO.md      # ✅ 本文件
```

---

## 关键注意事项

### ⚠️ 重要提醒

1. **文件命名规则**
   - 所有涉及 native module 的文件必须使用 `.native.ts` 后缀
   - 类型定义文件使用普通 `.ts` 后缀
   - 配置文件使用普通 `.ts` 后缀 (只要不 import native modules)

2. **Import 规则**
   - 严格遵守 monorepo 的 import 层级规则
   - `@onekeyhq/shared` 不能 import `@onekeyhq/kit` 或 `@onekeyhq/components`
   - 使用相对路径 import 本模块内的文件

3. **平台检测**
   - 如果需要在非 native 平台调用,必须先检测平台
   - 使用 `@onekeyhq/shared/src/platformEnv` 进行平台判断

4. **错误处理**
   - 所有 async 函数必须有 try/catch
   - 遵守 `@typescript-eslint/no-floating-promises` 规则
   - 所有 Promise 必须 await 或使用 `void` 前缀

5. **代码质量**
   - 所有代码必须通过 `yarn lint`
   - 所有代码必须通过 `yarn tsc:only`
   - 不允许使用 `any` 类型 (除非有充分理由)

---

## 测试 Checklist

### 功能测试

- [ ] NetInfo 网络状态检测正常
- [ ] DNS 解析功能正常
- [ ] TCP 连接测试正常
- [ ] TLS 握手测试正常
- [ ] Ping 功能正常
- [ ] HTTP 健康检查正常
- [ ] 网络日志收集正常
- [ ] 诊断报告生成正确
- [ ] 问题分析逻辑正确

### 平台兼容性测试

- [ ] iOS 模拟器运行正常
- [ ] Android 模拟器运行正常
- [ ] iOS 真机运行正常
- [ ] Android 真机运行正常
- [ ] Web 端编译不报错
- [ ] Desktop 端编译不报错
- [ ] Extension 端编译不报错

### 性能测试

- [ ] 诊断耗时在可接受范围内 (< 15 秒)
- [ ] 不影响应用启动速度
- [ ] Bundle size 增长在可接受范围内
- [ ] Tree shaking 正常工作 (非 native 平台不包含 native modules)

---

## 参考资料

### 源项目

- **位置**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/`
- **文档**: `/Users/leon/Documents/github/sni-expo-demo/src/network-doctor/README.md`

### OneKey 相关文档

- **项目指南**: `@x-app-monorepo/CLAUDE.md`
- **平台检测**: `@onekeyhq/shared/src/platformEnv`
- **Import 层级规则**: `CLAUDE.md` - "Import Hierarchy Rules"

### 依赖文档

- [@react-native-community/netinfo](https://github.com/react-native-netinfo/react-native-netinfo)
- [react-native-dns-lookup](https://github.com/michalsnik/react-native-dns-lookup)
- [react-native-network-logger](https://github.com/alexbrazier/react-native-network-logger)
- [react-native-ping](https://github.com/andrewlunde/react-native-ping)
- [react-native-tcp-socket](https://github.com/Rapsssito/react-native-tcp-socket)
- [react-native-network-info](https://github.com/pusherman/react-native-network-info)

---

## 完成标准

当以下所有条件满足时,认为实施完成:

1. ✅ 所有文件已创建并迁移
2. ✅ `yarn tsc:only` 通过,无 TypeScript 错误
3. ✅ `yarn lint` 通过,无 linting 错误
4. ✅ iOS 和 Android 平台功能测试通过
5. ✅ Web/Desktop/Extension 平台编译通过
6. ✅ Tree shaking 验证通过
7. ✅ 文档完整并已更新
8. ✅ Gallery 示例可正常运行
9. ✅ 代码已自我审查
10. ✅ 准备好提交 PR

---

## 时间估算

- **Phase 1-2**: 2 小时 (依赖安装 + 核心文件迁移)
- **Phase 3-4**: 1 小时 (入口文件 + 文档)
- **Phase 5**: 1 小时 (代码验证)
- **Phase 6**: 2 小时 (功能测试)
- **Phase 7-8**: 1 小时 (集成和优化)
- **Phase 9-10**: 1 小时 (文档和审查)

**总计**: 约 8 小时

---

## 问题追踪

### 已知问题

- [ ] 待定

### 待解决问题

- [ ] 是否需要为 Desktop 平台提供特殊实现? (Electron 可能支持部分 native 功能)
- [ ] 是否需要添加诊断结果缓存?
- [ ] 是否需要添加诊断结果上报功能?

---

## 更新日志

- **2025-11-15**: 创建初始 TODO 文档
- **待定**: 选择架构方案并开始实施

---

**下一步**: 请确认使用 **方案 A** 还是 **方案 B**,然后开始 Phase 1 的实施。
