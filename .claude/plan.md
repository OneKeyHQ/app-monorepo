# Legacy Native Module → Nitro Module 迁移计划

## 概述

将 `apps/mobile/ios/` 和 `apps/mobile/android/` 中的 7 个 legacy Bridge 模块迁移为 `~/Project/app-modules/native-modules/` 下的 Nitro Module。日志统一使用 `OneKeyLog`（nativelogger）。

## 模块划分

| 新模块名 | 来源 | 类型 |
|---------|------|------|
| `react-native-device-utils` (已有) | LaunchOptionsManager + ExitModule | 扩展现有模块 |
| `react-native-bundle-update` (新建) | BundleUpdateModule | 新 Nitro 模块 |
| `react-native-app-update` (新建) | AutoUpdateModule | 新 Nitro 模块 |
| `react-native-perf-memory` (新建) | PerfMemoryModule | 新 Nitro 模块 |
| `react-native-webview-checker` (新建) | WebViewCheckerModule | 新 Nitro 模块 |
| `react-native-splash-screen` (新建) | SplashScreenModule | 新 Nitro 模块 |

---

## 第一步：扩展 react-native-device-utils

### 修改 Nitro Spec (`ReactNativeDeviceUtils.nitro.ts`)

新增方法：

```typescript
// --- LaunchOptionsManager ---
getLaunchOptions(): Promise<LaunchOptions>;
clearLaunchOptions(): Promise<boolean>;
getDeviceToken(): Promise<string>;
registerDeviceToken(): Promise<boolean>;
getStartupTime(): Promise<number>;

// --- ExitModule ---
exitApp(): void;
```

新增类型：

```typescript
export interface LaunchOptions {
  launchType: 'normal' | 'localNotification' | 'remoteNotification' | 'deepLink';
  localNotification?: { userInfo: Record<string, unknown> };
  remoteNotification?: { userInfo: Record<string, unknown> };
  deepLink?: string;
}
```

### iOS Swift 实现

在 `ReactNativeDeviceUtils.swift` 中新增：
- `getLaunchOptions()` → 从 singleton 读取保存的 launch options
- `clearLaunchOptions()` → 清空
- `getDeviceToken()` → 从 singleton 读取 APNs token
- `registerDeviceToken()` → 调 JPush registerDeviceToken
- `getStartupTime()` → 从 singleton 读取启动时间
- `exitApp()` → `exit(0)` 或 `fatalError()`
- 日志改用 `OneKeyLog.info("DeviceUtils", msg)`

需要新增一个 `LaunchOptionsStore.swift` 单例：
- 由 AppDelegate 在启动时写入 launchOptions / deviceToken / startupTime
- 供 Nitro 模块读取

### Android Kotlin 实现

在 `ReactNativeDeviceUtils.kt` 中新增：
- `getLaunchOptions()` → 从 companion object static 变量读取
- `clearLaunchOptions()` → 清空
- `getDeviceToken()` → 返回空字符串（Android 无 APNs）
- `registerDeviceToken()` → 返回 true（Android 无需手动注册）
- `getStartupTime()` → 从 companion object static 变量读取
- `exitApp()` → `Process.killProcess(Process.myPid())`
- 日志改用 `OneKeyLog.info("DeviceUtils", msg)`

static 变量由 `MainApplication.onCreate()` 写入。

### JS 端适配

修改 `packages/shared/src/modules/LaunchOptionsManager/LaunchOptionsManager.native.ts`：
- 从 `NativeModules.LaunchOptionsManager` 改为 `import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils'`

---

## 第二步：新建 react-native-bundle-update

### 使用脚手架创建

```bash
cd ~/Project/app-modules
node scripts/create-nitro-module.js react-native-bundle-update
```

### Nitro Spec (`ReactNativeBundleUpdate.nitro.ts`)

```typescript
export interface BundleUpdateDownloadParams {
  downloadUrl: string;
  filePath: string;
}

export interface BundleUpdateInstallParams {
  appVersion: string;
  bundleVersion: string;
  filePath: string;
}

export interface UpdateBundleData {
  version: string;
  appVersion: string;
}

export interface BundleInfo {
  appVersion: string;
  bundleVersion: string;
  // ...
}

export interface DownloadProgress {
  progress: number;
}

export interface ReactNativeBundleUpdate
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // 下载 & 校验
  downloadBundle(params: BundleUpdateDownloadParams): Promise<void>;
  downloadBundleASC(params: BundleUpdateDownloadParams): Promise<void>;
  verifyBundle(params: BundleUpdateDownloadParams): Promise<void>;
  verifyBundleASC(params: BundleUpdateDownloadParams): Promise<void>;

  // 安装 & 管理
  installBundle(params: BundleUpdateInstallParams): Promise<void>;
  clearBundle(): Promise<void>;
  clearAllJSBundleData(): Promise<void>;

  // 查询
  getFallbackUpdateBundleData(): Promise<UpdateBundleData | undefined>;
  setCurrentUpdateBundleData(params: UpdateBundleData): Promise<void>;
  getNativeAppVersion(): string;
  getJsBundlePath(): string;
  getWebEmbedPath(): string;
  getWebEmbedPathAsync(): Promise<string>;
  getSha256FromFilePath(filePath: string): Promise<string>;
  isBundleExists(appVersion: string, bundleVersion: string): Promise<boolean>;
  verifyExtractedBundle(appVersion: string, bundleVersion: string): Promise<boolean>;
  listLocalBundles(): Promise<BundleInfo[]>;

  // 测试 / 调试
  testVerification(): Promise<boolean>;
  testDeleteJsBundle(appVersion: string, bundleVersion: string): Promise<void>;
  testDeleteJsRuntimeDir(appVersion: string, bundleVersion: string): Promise<void>;
  testDeleteMetadataJson(appVersion: string, bundleVersion: string): Promise<void>;
  testWriteEmptyMetadataJson(appVersion: string, bundleVersion: string): Promise<void>;

  // 事件回调（替代 NativeEventEmitter）
  addDownloadListener(callback: (event: DownloadEvent) => void): number;
  removeDownloadListener(id: number): void;
}

export interface DownloadEvent {
  type: 'start' | 'downloading' | 'complete' | 'error';
  progress?: number;
  message?: string;
}
```

### iOS Swift 实现

- 迁移 `BundleUpdateModule.m` 逻辑到 Swift
- NSURLSession 下载 → URLSession async/await
- SHA256 → CryptoKit 或 CommonCrypto
- ZIP 解压 → SSZipArchive (pod dependency)
- PGP 验证 → Gopenpgp (pod dependency)
- 事件 → 使用 callback listener 模式（同 device-utils 的 `addSpanningChangedListener` 模式）
- 日志 → `OneKeyLog`
- `getJSBundleFile()` 路径逻辑保留为 static util，供 AppDelegate 调用（不走 JS）

### Android Kotlin 实现

- 迁移 `BundleUpdateModule.java` 逻辑到 Kotlin
- OkHttp 下载保留
- SHA256 / ZIP / PGP 逻辑迁移
- 事件 → callback listener 模式
- 日志 → `OneKeyLog`
- `CustomReactNativeHost.getJSBundleFile()` 保留引用 static 工具方法

### JS 端适配

修改 `packages/shared/src/modules3rdParty/auto-update/index.native.ts`：
- BundleUpdate 部分从 `NativeModules.BundleUpdateModule` 改为 Nitro import
- `NativeEventEmitter` → 使用 `addDownloadListener` / `removeDownloadListener`

---

## 第三步：新建 react-native-app-update

### Nitro Spec (`ReactNativeAppUpdate.nitro.ts`)

```typescript
export interface AppUpdateDownloadParams {
  downloadUrl: string;
  filePath: string;
  notificationTitle?: string;
  fileSize?: number;
}

export interface DownloadEvent {
  type: 'start' | 'downloading' | 'downloaded' | 'error';
  progress?: number;
  message?: string;
}

export interface ReactNativeAppUpdate
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  downloadAPK(params: AppUpdateDownloadParams): Promise<void>;
  downloadASC(params: AppUpdateDownloadParams): Promise<void>;
  verifyASC(params: AppUpdateDownloadParams): Promise<void>;
  verifyAPK(params: AppUpdateDownloadParams): Promise<void>;
  installAPK(params: AppUpdateDownloadParams): Promise<void>;
  clearCache(): Promise<void>;

  addDownloadListener(callback: (event: DownloadEvent) => void): number;
  removeDownloadListener(id: number): void;
}
```

### 实现

- **Android**: 迁移 `AutoUpdateModule.java` → Kotlin，OkHttp 下载 + 通知栏进度 + GPG 校验 + APK 安装
- **iOS**: 空实现（APK 更新仅 Android）
- 日志 → `OneKeyLog`

---

## 第四步：新建 react-native-perf-memory

### Nitro Spec (`ReactNativePerfMemory.nitro.ts`)

```typescript
export interface MemoryUsage {
  rss: number;
}

export interface ReactNativePerfMemory
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  getMemoryUsage(): Promise<MemoryUsage>;
}
```

### 实现

- **iOS**: `task_vm_info` → `phys_footprint`，fallback `resident_size`
- **Android**: `/proc/self/status` VmRSS，fallback `totalPss`
- 日志 → `OneKeyLog`

---

## 第五步：新建 react-native-webview-checker

### Nitro Spec (`ReactNativeWebviewChecker.nitro.ts`)

```typescript
export interface WebViewPackageInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
}

export interface GooglePlayServicesStatus {
  status: number;
  isAvailable: boolean;
}

export interface ReactNativeWebviewChecker
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  getCurrentWebViewPackageInfo(): Promise<WebViewPackageInfo>;
  isGooglePlayServicesAvailable(): Promise<GooglePlayServicesStatus>;
}
```

### 实现

- **Android**: PackageManager 查询 WebView 版本 + GoogleApiAvailability 检查
- **iOS**: 空实现 / 返回默认值（iOS 无需检查 WebView 版本）
- 日志 → `OneKeyLog`

---

## 第六步：新建 react-native-splash-screen

### Nitro Spec (`ReactNativeSplashScreen.nitro.ts`)

```typescript
export interface ReactNativeSplashScreen
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  preventAutoHideAsync(): Promise<boolean>;
  hideAsync(): Promise<boolean>;
}
```

### 实现

- **Android**: 仅 `Build.VERSION.SDK_INT < Build.VERSION_CODES.S` 时生效，否则直接返回 true
- **iOS**: 空实现（iOS 使用 expo-splash-screen）
- 日志 → `OneKeyLog`

---

## 第七步：清理 Legacy 代码

### 删除 iOS 文件

- `apps/mobile/ios/OneKeyWallet/BundleUpdateModule.h`
- `apps/mobile/ios/OneKeyWallet/BundleUpdateModule.m`
- `apps/mobile/ios/OneKeyWallet/LaunchOptionsManager.h`
- `apps/mobile/ios/OneKeyWallet/LaunchOptionsManager.m`
- `apps/mobile/ios/OneKeyWallet/PerfMemoryModule.h`
- `apps/mobile/ios/OneKeyWallet/PerfMemoryModule.m`

### 删除 Android 文件

- `BundleUpdateModule.java` + `BundleUpdatePackage.java`
- `AutoUpdateModule.java` + `AutoUpdateModulePackage.java`（所有 flavor）
- `LaunchOptionModule.java` + `LaunchOptionPackage.java`
- `PerfMemoryModule.java` + `PerfMemoryPackage.java`
- `ExitModule.java` + `ExitPackage.java`
- `WebViewCheckerModule.java` + `WebViewCheckerPackage.java`
- `SplashScreenModule.java` + `SplashScreenPackage.java` + 相关 singletons

### 清理 MainApplication.java

移除所有手动添加的 legacy package 注册：

```java
// 删除以下行
packages.add(new AutoUpdateModulePackage(mReactNativeHost));
packages.add(new BundleUpdatePackage());
packages.add(new ExitPackage());
packages.add(new PerfMemoryPackage());
packages.add(new WebViewCheckerPackage());
packages.add(new LaunchOptionPackage());
packages.add(new SplashScreenPackage());
```

### 更新 JS 类型

修改 `packages/shared/types/rnNativeModules.ts`：
- 移除所有已迁移模块的类型定义

### 更新 JS Wrapper

- `packages/shared/src/modules3rdParty/auto-update/index.native.ts` → 改用 Nitro import
- `packages/shared/src/modules/LaunchOptionsManager/` → 改用 device-utils
- `packages/shared/src/performance/collectors/memoryCollector.native.ts` → 改用 perf-memory
- `packages/shared/src/modules3rdParty/webview-checker/index.android.tsx` → 改用 webview-checker
- `packages/components/src/content/Splash/SplashView.native.tsx` → 改用 splash-screen

---

## 关键设计决策

### 1. 事件发射 → Callback Listener

Legacy: `NativeEventEmitter` + `addListener('update/downloading', handler)`

Nitro: `addDownloadListener((event) => { ... })` 返回 listener ID，`removeDownloadListener(id)` 移除

参考 device-utils 中 `addSpanningChangedListener` 的模式。

### 2. getJSBundleFile() — 不走 Nitro

`CustomReactNativeHost.getJSBundleFile()` 在 JS 引擎启动前调用，不能通过 Nitro。保留为 native static 方法：
- iOS: `BundleUpdateStore.currentBundleMainJSBundle()` (static Swift)
- Android: `BundleUpdateStore.getCurrentBundleMainJSBundle(context)` (static Kotlin companion)

这些工具类放在 bundle-update 模块的 native code 中，但作为 static 方法独立于 HybridObject。

### 3. 日志统一

所有 legacy 的 `DDLogDebug` / `RCTLogInfo` / `FileLoggerModule.write()` / `Log.d()` 统一替换为：
- iOS: `OneKeyLog.debug(tag, msg)` / `.info()` / `.warn()` / `.error()`
- Android: `OneKeyLog.debug(tag, msg)` / `.info()` / `.warn()` / `.error()`

### 4. Pod/Gradle 依赖

新模块需要的额外依赖：
- `react-native-bundle-update`: SSZipArchive, Gopenpgp (iOS); OkHttp (Android)
- `react-native-app-update`: Gopenpgp (Android); 无 iOS 依赖
- `react-native-splash-screen`: expo-modules-core (Android splash singletons)
- 所有模块: `ReactNativeNativeLogger` (pod) / `onekeyfe_react-native-native-logger` (gradle)

---

## 执行顺序建议

1. **react-native-perf-memory** — 最简单，1 个方法，验证 Nitro 迁移流程
2. **react-native-webview-checker** — 简单，2 个方法，仅 Android
3. **react-native-splash-screen** — 简单，2 个方法，仅 Android
4. **react-native-device-utils** (扩展) — 中等，添加 launch options + exit
5. **react-native-app-update** — 中等复杂，涉及下载/通知/APK 安装
6. **react-native-bundle-update** — 最复杂，热更新全流程 + PGP 验证
7. **清理 legacy 代码** — 最后统一删除
