# RFC: 消除 web-embed 加密依赖 + 修复 Android PBKDF2 卡顿

**Status**: Draft
**Owner**: TBD
**Branch**: `claude/slack-session-hhCpf`

## 背景

OneKey iOS/Android 当前依赖 web-embed (WebView) 运行 PBKDF2/HMAC/secp256k1 等加密操作，依赖 WebView (JSC) 的 JIT 加速纯 JS crypto 实现。这导致：

1. **Android 解锁/创建钱包卡顿约 3 秒**
   - 600k PBKDF2 走 `react-native-aes-crypto` 的 SpongyCastle Java 实现（非真正 native C）
2. **web-embed 启动/通信开销**，且增加产物体积
3. **稳定性问题**：WebView ↔ RN bridge 不稳定，曾出现 `IncorrectPassword` 误报
4. **跨平台不一致**：web/desktop/extension 不需要 web-embed，路径分叉，维护成本高

## 行业现状对比（已源码验证）

| 钱包 | 是否装 quick-crypto | 新 vault 实际用的库 | Android 实际性能 | 源码链接 |
|------|-------------------|-----------------|----------------|----------|
| **Rabby Mobile** | ✅ | ✅ **react-native-quick-crypto** (JSI + fastpbkdf2 C) | ~100ms / 900k iters | [setup-app.ts](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/setup-app.ts), [scure-bip39 patch](https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@scure-bip39-npm-1.3.0-1d74c5c469.patch) |
| **MetaMask Mobile** | ✅ | ❌ react-native-aes-crypto（SpongyCastle Java） | ~1-3s / 900k iters（同 OneKey 量级，用 caching + loading 动画掩盖） | [Encryptor.ts](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/Encryptor.ts), [aesforked Java](https://github.com/MetaMask/react-native-aes-crypto-forked/blob/master/android/src/main/java/com/tectiv3/aesforked/RCTAesForked.java) |
| **OneKey 现状** | ❌ | react-native-aes-crypto（SpongyCastle Java） | **~3s / 600k iters** | `packages/shared/src/appCrypto/modules/pbkdf2.ts` |
| Trust Wallet | - (非 React Native) | wallet-core C++ + trezor-crypto | 原生 | [wallet-core](https://github.com/trustwallet/wallet-core/tree/master/trezor-crypto/crypto) |
| Uniswap Wallet | - | RNEthersRS (Rust ethers-rs) | 原生 | [Keyring.native.ts](https://github.com/Uniswap/wallet/blob/main/packages/wallet/src/features/wallet/Keyring/Keyring.native.ts) |
| Rainbow | ❌ | react-native-aes-crypto + 仅 5000 iters | 快但安全性弱 | [aesEncryption.ts](https://github.com/rainbow-me/rainbow/blob/develop/src/handlers/aesEncryption.ts) |
| BlueWallet | ❌ | crypto-js (1 iter EVP_BytesToKey) | N/A，几乎无 KDF | [encryption.ts](https://github.com/BlueWallet/BlueWallet/blob/master/blue_modules/encryption.ts) |
| Edge | (WebView worker 方案) | scrypt 不是 PBKDF2 | 不可比 | [edge-core-js](https://github.com/EdgeApp/edge-core-js) |

**真正在生产环境用 quick-crypto JSI 跑 OWASP-recommended PBKDF2 iterations 的 RN 钱包，目前只有 Rabby Mobile 一家。**

## 目标

**短期**：把 PBKDF2 / HMAC / AES 全部走 `react-native-quick-crypto` (JSI → fastpbkdf2/OpenSSL)，**Android 解锁从 3s 降到 ~100-200ms**

**长期**：移除 web-embed 加密依赖，统一所有平台 crypto 实现路径

## Scope - 各函数提速策略

| # | 操作 | 当前实现 | 目标实现 | 文件 | Android 耗时（预期） | 优先级 |
|---|------|---------|---------|------|-------------------|--------|
| 1 | **PBKDF2 (vault 600k)** | `react-native-aes-crypto` → SpongyCastle Java | `react-native-quick-crypto` `pbkdf2Sync/Async` → fastpbkdf2 C (JSI) | `packages/shared/src/appCrypto/modules/pbkdf2.ts` | **3000ms → ~100ms (30x)** | 🔴 P0 |
| 2 | **PBKDF2 (mnemonicToSeed 2048)** | `bip39` npm → `@noble/hashes/pbkdf2` 纯 JS | Metro resolver 别名 `@noble/hashes/pbkdf2` → quick-crypto shim | `apps/mobile/metro.config.js`, 新增 `shims/noble-pbkdf2-native.js` | 100ms → 2-5ms (20-50x) | 🔴 P0 |
| 3 | **HMAC-SHA512 sync (CKDPriv 热路径)** | `asmcrypto.js` 纯 JS | quick-crypto `createHmac` JSI 同步 | `packages/shared/src/appCrypto/modules/hash.ts:167` | 8ms × 5N → <1ms × 5N | 🔴 P0 |
| 4 | **HMAC-SHA512 async** | `RN_AES.hmac512` via NativeModules bridge (Android Conscrypt 实际是 native C，但有桥接开销) | quick-crypto `createHmac` JSI（去掉 bridge overhead） | `packages/shared/src/appCrypto/modules/hash.ts:111` | 桥接 5ms + 计算 1ms → <1ms | 🟡 P1 |
| 5 | **AES-256-CBC encrypt/decrypt** | `react-native-aes-crypto` via NativeModules bridge | quick-crypto `createCipheriv` JSI | `packages/core/src/secret/encryptors/aes256.ts` | 桥接占大头 → 0 | 🟡 P1 |
| 6 | **AES-256-GCM (V2 format)** | 部分 native | quick-crypto AES-GCM JSI | `packages/core/src/secret/encryptors/aes256.ts` | 同上 | 🟡 P1 |
| 7 | **secp256k1 `publicFromPrivate`** | `elliptic` 纯 JS BigInteger | 选项 A: `@noble/secp256k1`（JS，2-3x 快，迁移容易）<br>选项 B: quick-crypto Node EC API (native，API 重写) | `packages/core/src/secret/curves/elliptic.ts` | 50-200ms → 20-50ms (A) / 5-10ms (B) | 🟡 P1 |
| 8 | **SHA-256 / SHA-512** | 多 backend，默认 asmcrypto JS | 默认改 quick-crypto JSI | `packages/shared/src/appCrypto/modules/hash.ts` | 边际改进 | 🟢 P2 |
| 9 | **关闭 web-embed 默认开关** | `useWebembedApi: true` (默认) | 默认 false，web-embed 留作 fallback | `packages/core/src/secret/index.ts:708,889` | - | 🟡 P1 |
| 10 | **清理无效 backend** | `react-native-fast-pbkdf2` 实际也是 SpongyCastle，名不副实 | 删除该 backend 选项 | `packages/shared/src/appCrypto/modules/pbkdf2.ts:55` | - | 🟢 P2 |
| 11 | **彻底移除 web-embed crypto 模块** | 仍保留 | P0-P1 上线稳定 1-2 版本后移除 | `packages/web-embed/*` | - | 🟢 P3 |

## 技术方案

### 基础设施
- 新增依赖：`react-native-quick-crypto` (v3.x, Nitro Modules) - 推荐用最新版避免历史 bug
- 新增依赖：`@craftzdog/react-native-buffer`（quick-crypto Buffer 兼容性需要）
- `apps/mobile/src/setup-app.ts` 中**最早期**调用 `install()` 注入 `global.crypto` polyfill（必须在所有业务 import 前）

### Metro Resolver Shim Pattern
参考 OneKey 现有 `Developer/router.empty.ts` 模式（`UNION_BUILD=true` 时拦截）：

```js
// apps/mobile/metro.config.js
const NOBLE_PBKDF2_SHIM = path.resolve(__dirname, 'shims/noble-pbkdf2-native.js');

if (platform !== 'web' && (
  moduleName === '@noble/hashes/pbkdf2' ||
  moduleName === '@noble/hashes/pbkdf2.js'
)) {
  return { type: 'sourceFile', filePath: NOBLE_PBKDF2_SHIM };
}
```

shim 内容：

```js
// apps/mobile/shims/noble-pbkdf2-native.js
const original = require.cache[require.resolve('@noble/hashes/pbkdf2')]?.exports || {};
let quickCrypto;
function lazyInit() {
  if (!quickCrypto) quickCrypto = require('react-native-quick-crypto');
  return quickCrypto;
}
function detectAlgorithm(hashFn) {
  if (hashFn.outputLen === 64) return 'sha512';
  if (hashFn.outputLen === 32) return 'sha256';
  throw new Error(`Unsupported noble hash (outputLen=${hashFn.outputLen})`);
}
module.exports = {
  ...original,
  pbkdf2: (hashFn, pwd, salt, opts) => {
    const result = lazyInit().pbkdf2Sync(
      Buffer.from(pwd), Buffer.from(salt), opts.c, opts.dkLen, detectAlgorithm(hashFn)
    );
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  },
  pbkdf2Async: (hashFn, pwd, salt, opts) => new Promise((resolve, reject) => {
    lazyInit().pbkdf2(
      Buffer.from(pwd), Buffer.from(salt), opts.c, opts.dkLen, detectAlgorithm(hashFn),
      (err, key) => err ? reject(err) : resolve(new Uint8Array(key.buffer, key.byteOffset, key.byteLength))
    );
  }),
};
```

### 测试策略
利用现有 [`CryptoGallery.tsx SecretFunctionsTest`](file:///packages/kit/src/views/Developer/pages/Gallery/Components/stories/CryptoGallery.tsx)：

- 对每个改动函数，跑同样输入：(web-embed JS path) vs (quick-crypto native path) vs (现有 asmcrypto path)
- **字节级 assert 输出一致**（防止派生不同密钥导致钱包灾难）
- 增加 perf 测试 UI 显示三条路径耗时对比
- 用 100 个固定 BIP39 测试向量做 round-trip 测试

### 风险控制
- **每步独立可灰度**：通过 dev settings 开关切换 backend，便于回退
- **保留 web-embed 路径**：作为 fallback，确认稳定后再删
- **数据库迁移**：不需要（PBKDF2/HMAC/AES 都是无状态函数，旧 vault 内含 iterations，可继续解密）
- **不变项**：迭代次数、salt 长度、密钥长度、密文格式全部不变

### 借鉴 MetaMask 的教训
MetaMask 在 quick-crypto 迁移过程中：
- 2025-02 commit "Revert native HMACSHA512 usage" - 原生 HMAC 出 bug 被回滚
- 2025-05 重新尝试
- 2025-12 还在过渡

**OneKey 必须做的额外保险**：
1. 在 dev 设置里加 backend 切换开关（OneKey 现已有这个机制，复用即可）
2. 灰度发布前用 `SecretFunctionsTest` 对固定 mnemonic 集合跑字节级一致性测试
3. 上线后保留 `react-native-aes-crypto` 路径 **至少 2 个版本** 作为 fallback
4. 监控加密相关 error 上报（特别是 `IncorrectPassword`、`InvalidMnemonic`）
5. 准备好 remote config 回滚开关

## 成功指标

| 指标 | 目标 |
|------|------|
| Android 解锁钱包耗时 | **3000ms → ≤200ms** (P95) |
| Android 创建钱包耗时 | **~5000ms → ≤500ms** (P95) |
| Android 派生 10 个 EVM 地址耗时 | **~2000ms → ≤200ms** (P95) |
| iOS 同场景耗时 | 持平或更优 |
| web-embed 加载次数（解锁场景） | 1 → 0 |
| `IncorrectPassword` bug 数 | 减少 50%+ |
| Bundle 体积（apps/mobile） | 增加 ≤3MB（quick-crypto + OpenSSL） |

## Rollout Plan

| Phase | 内容 | 周期 |
|-------|------|------|
| **Phase 1** | P0 (项 1, 2, 3) - 解决 Android 3s 卡顿 | Week 1-2 |
| **Phase 2** | P1 (项 4, 5, 6, 7, 9) - 完整切换 native，关闭 web-embed 默认 | Week 3-4 |
| **Phase 3** | 灰度上线（10% → 50% → 100%） | Week 5 |
| **Phase 4** | P2-P3 (项 8, 10, 11) - 清理 | 下个版本 |

## Out of Scope

- 替换 BIP39 wordlist / BIP32 算法实现本身（控制流 JS 即可，无需 native）
- 整体下沉到 Rust（参考 Uniswap RNEthersRS 模式）- 评估为 4 周以上工作量，本 RFC 不覆盖
- Web/Desktop/Extension 平台优化（这些平台已经有 BoringSSL/OpenSSL 通过浏览器/Node 提供）

## References

### Rabby Mobile（已源码验证的最佳参考）
- `apps/mobile/src/setup-app.ts` (quick-crypto install) - https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/setup-app.ts
- `@scure/bip39` patch (mnemonicToSeed → quick-crypto) - https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@scure-bip39-npm-1.3.0-1d74c5c469.patch
- `@metamask/browser-passworder` patch (subtle deriveBits → quick-crypto) - https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@metamask-browser-passworder-npm-6.0.0-b3e10a0dba.patch
- `packages/service-keyring/src/keyringService.ts` - https://github.com/RabbyHub/rabby-mobile/blob/develop/packages/service-keyring/src/keyringService.ts

### MetaMask Mobile（参考但未完全采用）
- `app/core/Encryptor/Encryptor.ts` - https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/Encryptor.ts
- `app/core/Encryptor/lib/quick-crypto.ts` (有 QuickCryptoLib 但新 vault 不用) - https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/lib/quick-crypto.ts

### Native library 源码
- quick-crypto C++ PBKDF2 - https://github.com/margelo/react-native-quick-crypto/blob/main/packages/react-native-quick-crypto/cpp/pbkdf2/HybridPbkdf2.cpp
- fastpbkdf2 C 库（SIMD 优化）- https://github.com/ctz/fastpbkdf2
- quick-crypto subtle WebCrypto 实现 - https://github.com/margelo/react-native-quick-crypto/blob/main/packages/react-native-quick-crypto/src/subtle.ts

### SpongyCastle 性能问题溯源
- `react-native-aes-crypto` Android Aes.java (vanilla) - https://github.com/tectiv3/react-native-aes/blob/master/android/src/main/java/com/tectiv3/aes/Aes.java
- MetaMask `react-native-aes-crypto-forked` Android (同样 SpongyCastle) - https://github.com/MetaMask/react-native-aes-crypto-forked/blob/master/android/src/main/java/com/tectiv3/aesforked/RCTAesForked.java
- OneKey 自家 `react-native-pbkdf2` Android (同样 SpongyCastle) - https://github.com/OneKeyHQ/app-modules/tree/main/native-modules/react-native-pbkdf2/android/src/main/java/com/pbkdf2
