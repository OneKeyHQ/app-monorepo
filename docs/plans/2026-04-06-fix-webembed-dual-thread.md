# Fix WebEmbed Bridge in Dual-Thread Mode

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix wallet creation failure in dual-thread (split-bundle) mode caused by `webEmbedBridge` being null in the background thread.

**Architecture:** In dual-thread mode, the webEmbed bridge call should stay in the main thread where the actual JsBridge exists, instead of being routed to the background thread. We add a `callWebEmbedBridgeLocal()` method on `BackgroundApiProxyBase` and modify `webembedApiProxy.callRemoteApi()` to use it in dual-thread mode. Single-thread mode is completely unchanged.

**Tech Stack:** TypeScript, React Native, JsBridge, SharedRPC transport

---

## Root Cause

In dual-thread mode:
1. `connectWebEmbedBridge()` syncs bridge **metadata** to the background thread, but the actual JsBridge object stays in the main thread (`mainThreadBridgeMap['webEmbed']`)
2. `handleBridgeConnectRequest()` in the background thread only stores metadata in `bridgeStateMap` — it never calls `backgroundApi.connectWebEmbedBridge(bridge)`
3. `ProviderApiPrivate.callWebEmbedApiProxy()` waits for `bg.webEmbedBridge` which is always null → 3-min timeout → failure

## Fix Strategy

Two changes:
1. **`BackgroundApiProxyBase.connectWebEmbedBridge()`**: Also set the bridge on the local BackgroundApi (main thread), not just sync to background
2. **`webembedApiProxy.callRemoteApi()`**: In dual-thread mode, call bridge locally via `backgroundApiProxy.callWebEmbedBridgeLocal()` instead of routing through background thread's `serviceDApp.callWebEmbedApiProxy()`

**Single-thread mode**: No code path changes. The dual-thread detection guards (`platformEnv.isNativeMainThread && platformEnv.enableNativeBackgroundThread`) ensure zero impact.

---

### Task 1: Set webEmbed bridge on local BackgroundApi in main thread

**Files:**
- Modify: `packages/kit-bg/src/apis/BackgroundApiProxyBase.ts:353-395`

**What:** When dual-thread transport sync succeeds, also call `connectLocalBackgroundBridge('webEmbed', bridge)` so the main thread's local BackgroundApi has the bridge reference.

**Step 1: Modify `connectWebEmbedBridge`**

In the `.then()` chain after `syncBridgeConnection` succeeds, also call the local bridge connect:

```typescript
connectWebEmbedBridge(bridge: JsBridgeBase | null) {
    const hasTransport = !!this.getNativeBackgroundThreadTransport();
    defaultLogger.app.webembed.connectWebEmbedBridgeEntry({
      isMainThread: !!platformEnv.isNativeMainThread,
      enableBgThread: !!platformEnv.enableNativeBackgroundThread,
      hasTransport,
      bridgeExists: !!bridge,
    });
    if (
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread
    ) {
      const transport = this.getNativeBackgroundThreadTransport();
      if (transport) {
+       // Always set bridge on local BackgroundApi so main-thread
+       // callWebEmbedBridgeLocal() can use it directly.
+       void this.connectLocalBackgroundBridge('webEmbed', bridge);
        void Promise.resolve()
          .then(() => {
            defaultLogger.app.webembed.connectWebEmbedBridgeTransportReady();
            return transport.ensureReady?.();
          })
          .then(() =>
            transport.syncBridgeConnection(
              {
                channel: 'webEmbed',
                bridge,
              },
              () => this.connectLocalBackgroundBridge('webEmbed', bridge),
            ),
          )
          .then(() => {
            defaultLogger.app.webembed.connectWebEmbedBridgeSyncDone();
          })
          .catch((error) => {
            defaultLogger.app.webembed.connectWebEmbedBridgeSyncError({
              error: String(error),
            });
            console.error('connectWebEmbedBridge relay failed', error);
          });
        return;
      }
    }
    defaultLogger.app.webembed.connectWebEmbedBridgeDirect();
    this.backgroundApi?.connectWebEmbedBridge(bridge);
  }
```

Key: `void this.connectLocalBackgroundBridge('webEmbed', bridge)` is added BEFORE the transport sync chain. This ensures the main thread's local BackgroundApi always has the bridge, regardless of transport state.

---

### Task 2: Add `callWebEmbedBridgeLocal` method to BackgroundApiProxyBase

**Files:**
- Modify: `packages/kit-bg/src/apis/BackgroundApiProxyBase.ts`

**What:** Add a public method that calls the webEmbed bridge directly in the main thread, replicating the essential logic from `ProviderApiPrivate.callWebEmbedApiProxy()`.

**Step 1: Add import for `isWebEmbedApiAllowedOrigin`**

```typescript
import { isWebEmbedApiAllowedOrigin } from './backgroundApiPermissions';
```

**Step 2: Add import for `waitForDataLoaded` and `timerUtils`**

```typescript
import { waitForDataLoaded } from '@onekeyhq/shared/src/utils/promiseUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
```

**Step 3: Add the method after `connectWebEmbedBridge`**

```typescript
async callWebEmbedBridgeLocal(
  data: IBackgroundApiWebembedCallMessage,
): Promise<any> {
  const bg = this.ensureLocalBackgroundApi() as unknown as
    | import('./BackgroundApiBase').default
    | undefined;

  defaultLogger.app.webembed.callWebEmbedApiProxyEntry({
    module: data?.module || '',
    method: data?.method || '',
    isWebEmbedApiReady: true, // already confirmed by waitRemoteApiReady
    hasWebEmbedBridge: !!bg?.webEmbedBridge,
  });

  await waitForDataLoaded({
    data: () => Boolean(bg?.webEmbedBridge),
    logName: `callWebEmbedBridgeLocal: bridge=${Boolean(bg?.webEmbedBridge)}`,
    wait: 1000,
    timeout: timerUtils.getTimeDurationMs({ minute: 3 }),
  });

  if (!bg?.webEmbedBridge?.request) {
    throw new OneKeyLocalError('webembed webview bridge not ready (local).');
  }

  const webviewOrigin = bg.webEmbedBridge.remoteInfo?.origin || '';
  defaultLogger.app.webembed.callWebEmbedApiProxyBridgeReady({
    module: data?.module || '',
    method: data?.method || '',
    origin: webviewOrigin,
  });

  if (!isWebEmbedApiAllowedOrigin(webviewOrigin)) {
    throw new OneKeyLocalError(
      `callWebEmbedBridgeLocal not allowed origin: ${webviewOrigin || 'undefined'}`,
    );
  }

  const result = await bg.webEmbedBridge.request({
    scope: '$private',
    data,
  });
  return result;
}
```

**Step 4: Add import for `IBackgroundApiWebembedCallMessage`**

```typescript
import type { IBackgroundApiWebembedCallMessage } from './IBackgroundApi';
```

---

### Task 3: Route webembed calls to main-thread bridge in dual-thread mode

**Files:**
- Modify: `packages/kit-bg/src/webembeds/instance/webembedApiProxy.ts:56-86`

**What:** In `callRemoteApi()`, detect dual-thread mode and call `backgroundApiProxy.callWebEmbedBridgeLocal()` instead of routing through `serviceDApp.callWebEmbedApiProxy()`.

**Step 1: Add platformEnv import** (already imported)

**Step 2: Modify `callRemoteApi`**

```typescript
protected override async callRemoteApi(options: {
  module: IWebembedApiKeys;
  method: string;
  params: any[];
}): Promise<any> {
  const { module, method, params } = options;
  const message: IBackgroundApiWebembedCallMessage = {
    module: module as any,
    method,
    params,
  };

  const bgApiProxy = checkIsDefined(appGlobals?.$backgroundApiProxy);

  let result: any;
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    // Dual-thread: call bridge directly in main thread.
    // The background thread doesn't have the JsBridge object,
    // so routing through serviceDApp.callWebEmbedApiProxy would hang.
    result = await bgApiProxy.callWebEmbedBridgeLocal(message);
  } else {
    // Single-thread: existing flow through background serviceDApp
    result = await bgApiProxy.serviceDApp.callWebEmbedApiProxy(message);
  }

  if (
    module === 'secret' &&
    ['batchGetPublicKeys', 'encryptAsync', 'decryptAsync'].includes(method) &&
    result === undefined
  ) {
    defaultLogger.app.webembed.webembedApiCallResultIsUndefined({
      module,
      method,
    });
  }

  return result;
}
```

---

### Task 4: Verify and build

**Step 1: Run TypeScript check on modified files**

```bash
cd /Users/huhuanming/Project/app-monorepo
npx tsc --noEmit --project packages/kit-bg/tsconfig.json 2>&1 | head -30
```

**Step 2: Rebuild via round4 flow**

```bash
cd apps/mobile
ENABLE_NATIVE_BACKGROUND_THREAD=true UNION_BUILD=true \
  node --max-old-space-size=8192 scripts/unionBuild.js \
  --platform ios \
  --common-bundle-output ios-bundle/common.jsbundle \
  --common-sourcemap-output ios-bundle/common.jsbundle.map \
  --main-bundle-output ios-bundle/main.jsbundle \
  --main-sourcemap-output ios-bundle/main.jsbundle.map \
  --background-bundle-output ios-bundle/background.bundle.js \
  --background-sourcemap-output ios-bundle/background.bundle.map \
  --assets-dest ios-bundle/assets
```

**Step 3: Deploy to simulator**

```bash
APP="ios/build/Build/Products/Release-iphonesimulator/OneKeyWallet.app"
rsync -a ios-bundle/assets/ "$APP/"
cp ios-bundle/common.jsbundle "$APP/common.jsbundle"
cp ios-bundle/main.jsbundle "$APP/main.jsbundle"
cp ios-bundle/background.bundle.js "$APP/background.bundle"
rsync -a --delete dist/segments/ "$APP/segments/"
rsync -a --delete dist/segments-background/ "$APP/segments-background/"
cd "$APP/segments" && for f in *.seg.js; do cp "$f" "${f%.seg.js}.seg.hbc"; done
cd "$APP/segments-background" && for f in *.seg.js; do cp "$f" "${f%.seg.js}.seg.hbc"; done
cd /Users/huhuanming/Project/app-monorepo/apps/mobile
codesign --force --sign - --timestamp=none --preserve-metadata=identifier,entitlements "$APP/Frameworks/GPChannelSDKCore.framework"
codesign --force --sign - --timestamp=none --preserve-metadata=identifier,entitlements "$APP"
SIM_ID="C929FAED-A2B5-48A4-8019-51CAE3390D39"
xcrun simctl uninstall "$SIM_ID" so.onekey.wallet || true
xcrun simctl install "$SIM_ID" "$APP"
xcrun simctl launch "$SIM_ID" so.onekey.wallet
```

**Step 4: Verify wallet creation**

1. Create wallet in simulator
2. Check NativeLogger log for `callWebEmbedApiProxyEntry: hasWebEmbedBridge=true`
3. Confirm no timeout/failure

**Step 5: Commit**

```bash
git add packages/kit-bg/src/apis/BackgroundApiProxyBase.ts packages/kit-bg/src/webembeds/instance/webembedApiProxy.ts
git commit -m "fix(split-bundle): route webembed bridge calls to main thread in dual-thread mode"
```
