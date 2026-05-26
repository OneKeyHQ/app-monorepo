# RFC: 消除 web-embed 加密依赖 + 修复 Android PBKDF2 卡顿

**Status**: Draft
**Owner**: TBD
**Branch**: `claude/slack-session-hhCpf`

## 背景

OneKey iOS/Android 当前依赖 web-embed (WebView) 运行 PBKDF2/HMAC/secp256k1 等加密操作，依赖 WebView (JSC) 的 JIT 加速纯 JS crypto 实现。这导致：

1. **Android 解锁/创建钱包卡顿约 3 秒**
   - 600k PBKDF2 走 `react-native-aes-crypto` 的 SpongyCastle Java 实现（**非真正 native C**，详见下方根因分析）
2. **web-embed 启动/通信开销**，且增加产物体积
3. **稳定性问题**：WebView ↔ RN bridge 不稳定，曾出现 `IncorrectPassword` 误报
4. **跨平台不一致**：web/desktop/extension 不需要 web-embed，路径分叉，维护成本高

## 根因分析（Why Android slow, iOS not）

**核心结论**：Rabby Mobile 之所以 PBKDF2 快，是因为它是**真原生 C**（fastpbkdf2 via JSI）；其他 RN 钱包在 **Android 上是 Java 伪原生**（SpongyCastle Java via NativeModules bridge）。

### 两个独立性能因子

**因子 1：算法实现语言（C 真原生 vs Java 伪原生）**

| 钱包 | Android PBKDF2 实现 | iOS PBKDF2 实现 |
|------|--------------------|----|
| Rabby Mobile | **fastpbkdf2 C** (JSI) ✅ 真原生 | **fastpbkdf2 C** (JSI) ✅ 真原生 |
| MetaMask / Rainbow / OneKey | **SpongyCastle Java** ❌ 伪原生（Java bytecode 跑在 ART 虚拟机） | **CommonCrypto C** ✅ 真原生（Apple 系统库） |

这解释了为什么 **OneKey 卡顿主要在 Android 反馈，iOS 用户体感正常** - iOS 走 CommonCrypto 是真 native C，60 万 iters 约 200-500ms（可接受）；Android SpongyCastle 同样 iters 要 3 秒。

**因子 2：JS↔Native 通信方式（JSI vs NativeModules Bridge）**

```
传统 NativeModules Bridge (react-native-aes-crypto 用这个)：
JS → 参数序列化 (hex string) → 跨线程发到 native → 计算 → 结果序列化 → 跨线程发回 JS
                              ↑ 每次桥接 +2-5ms

JSI (react-native-quick-crypto 用这个)：
JS → 直接调 C++ 函数（同线程，零拷贝） → 返回
                              ↑ 桥接 0ms
```

- **单次大计算**（PBKDF2 900k）：桥接 5ms 占比小
- **频繁小调用**（BIP32 派生 5N 次 HMAC）：桥接 5N×5ms = 大头

**Rabby 的双重优势**：C 实现（vs Java）+ JSI（vs Bridge）叠加。

### iOS vs Android 性能对照（OneKey 600k PBKDF2 估算）

| 平台 | 实现链路 | 耗时估算 |
|------|---------|---------|
| iOS | RN → react-native-aes-crypto → CommonCrypto C | 200-500ms（可接受） |
| Android | RN → react-native-aes-crypto → SpongyCastle Java | **3000ms（卡顿）** |
| Android（迁移后） | RN → quick-crypto → fastpbkdf2 C via JSI | **~100ms（流畅）** |

## 行业现状对比（已源码验证）

> **重要说明**：表格中所有数据均经 GitHub 源码逐文件验证，包括对每个钱包仓库的 `package.json`、加密相关 service、所有 `new Encryptor(...)` instantiation 点搜索。详细调研见 [附录 A: Rabby Mobile 深度调研](#附录-a-rabby-mobile-深度调研已源码验证) 和 [附录 B: MetaMask Mobile 深度调研](#附录-b-metamask-mobile-深度调研已源码验证)。

| 钱包 | 实际 PBKDF2 iters | Android 后端 | Android 估算耗时 | 安全等级 |
|------|------------------|------------|----------------|---------|
| **Rabby Mobile** | **900,000** ✅ OWASP 默认 | quick-crypto fastpbkdf2 C (JSI) | **~100-150ms** | 🟢 高 + 快 |
| **OneKey 当前** | **600,000** ✅ OWASP 最低 | react-native-aes-crypto SpongyCastle Java | **~3000ms** | 🟡 高 + 慢（痛点） |
| **MetaMask Mobile** | **5,000** ❌ Legacy | react-native-aes-crypto SpongyCastle Java | ~10-50ms | 🔴 低 + 凑合 |
| **Rainbow** | **5,000** ❌ Legacy | react-native-aes-crypto SpongyCastle Java | ~10-50ms | 🔴 低 + 凑合 |
| Trust Wallet | （非 React Native） | wallet-core C++ + trezor-crypto | 原生 C | 🟢 高 + 快 |
| Uniswap Wallet | （Rust ethers-rs） | RNEthersRS via FFI | 原生 Rust | 🟢 高 + 快 |
| BlueWallet | 1（EVP_BytesToKey，几乎无 KDF） | crypto-js 纯 JS | N/A | 🔴 极低 |
| Edge | scrypt（不是 PBKDF2） | scrypt-js + WebView worker | 不可比 | 🟡 |

### 关键结论

1. **Rabby Mobile 是唯一在生产环境用 quick-crypto JSI 跑 OWASP 推荐 PBKDF2 iterations 的 RN 钱包**
2. **MetaMask Mobile 装了 quick-crypto 但生产环境不用它**，且**新 vault PBKDF2 只跑 5000 iters**（详见附录 B）
3. **OneKey 是行业唯一"老老实实做了高安全（600k OWASP）但没做对应性能优化"的钱包**
4. 抄 Rabby 的方案 = 同时拿到高安全 + 快速度，**不是中庸方案，是唯一双赢方案**

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

---

## 附录 A: Rabby Mobile 深度调研（已源码验证）

> **结论**：Rabby Mobile 是唯一在生产环境用 quick-crypto JSI + fastpbkdf2 C 跑 OWASP 推荐 900k PBKDF2 iterations 的 React Native 钱包。OneKey 应**直接抄此方案**。

### A.1 PBKDF2 完整调用链（5 层源码全验证）

#### 层 1：库默认值 = 900,000 iterations
[`@metamask/browser-passworder@v6.0.0/src/index.ts:42-46`](https://github.com/MetaMask/browser-passworder/blob/v6.0.0/src/index.ts)
```ts
const DEFAULT_DERIVATION_PARAMS: KeyDerivationOptions = {
  algorithm: 'PBKDF2',
  params: {
    iterations: 900_000,   // ← OWASP 2023 推荐值
  },
};
```

#### 层 2：Rabby 的 patch 不动 iterations
[`@metamask-browser-passworder-npm-6.0.0-b3e10a0dba.patch`](https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@metamask-browser-passworder-npm-6.0.0-b3e10a0dba.patch)
- 仅把 `crypto.subtle.deriveKey` 拆成 `deriveBits + importKey`（让 quick-crypto polyfill 能接管）
- 仅把 `crypto.subtle` 改成 `globalThis.crypto.subtle`
- iteration 部分透传 `opts.params.iterations`

#### 层 3：encryptor 适配器是透传
[`packages/service-keyring/src/utils/encryptor.ts`](https://github.com/RabbyHub/rabby-mobile/blob/develop/packages/service-keyring/src/utils/encryptor.ts)
```ts
export const nodeEncryptor = {
  encrypt: browserPasswordor.encrypt,           // 函数指针，无 opts
  decrypt: browserPasswordor.decrypt,
  decryptWithDetail: browserPasswordor.decryptWithDetail,
  decryptWithExportedKey: async (vault, keyStr) => {
    const key = await browserPasswordor.importKey(keyStr);
    return browserPasswordor.decrypt('', vault, key);
  },
};
```

#### 层 4：password.ts 调用都是 2 参数
[`packages/service-keyring/src/utils/password.ts`](https://github.com/RabbyHub/rabby-mobile/blob/develop/packages/service-keyring/src/utils/password.ts)
```ts
const { vault } = await encryptWithDetail(password, data);      // 2 args
const { vault } = await decryptWithDetail(password, encryptedData);
```

#### 层 5：keyringService 全部 8 个加密点都是 2 参数（零 opts）
[`packages/service-keyring/src/keyringService.ts`](https://github.com/RabbyHub/rabby-mobile/blob/develop/packages/service-keyring/src/keyringService.ts)
- L208: `await this.encryptor.encrypt(password, 'true')`
- L226: `await this.encryptor.decrypt(password, encryptedBooted)`
- L263: `await this.encryptor.encrypt(this.#password, mnemonic)`
- L267: `await this.encryptor.decrypt(this.#password, ...)`
- L1037: `await this.encryptor.encrypt(this.#password, serializedKeyrings)`
- L1054: `await this.encryptor.decryptWithExportedKey(...)`
- L1083: `await this.encryptor.decryptWithDetail(password, encryptedVault)`
- L1107: `await this.encryptor.decrypt(this.#password, encryptedVault)`

**全仓搜索 `"iterations"`、`"900_000"`、`"10_000"`、`"OLD_DERIVATION_PARAMS"` 字面量：零匹配。** 所有调用透传默认值 = 900k。

### A.2 quick-crypto 安装链路

[`apps/mobile/src/setup-app.ts`](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/setup-app.ts)
```ts
import { install } from 'react-native-quick-crypto';
install();   // 注入 global.crypto + global.crypto.subtle
```

调用链最终路径：
```
Rabby JS: encryptWithDetail(password, data)
  ↓ @metamask/browser-passworder@6.0.0 (Yarn patched)
  ↓ globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', iterations: 900000 })
  ↓ react-native-quick-crypto subtle.ts (polyfill)
  ↓ JSI → C++ HybridPbkdf2.cpp
  ↓ fastpbkdf2_hmac_sha256(...)   ← ctz/fastpbkdf2 C + SIMD
  → ~100-150ms on Android
```

### A.3 mnemonicToSeed 走 quick-crypto 的 patch
[`@scure-bip39-npm-1.3.0-1d74c5c469.patch`](https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@scure-bip39-npm-1.3.0-1d74c5c469.patch)

把 `@scure/bip39` 库内部对 `@noble/hashes/pbkdf2` 的调用替换为：
```js
const mnemonicBuffer = new react_native_buffer.Buffer(mnemonic, "utf8");
const saltBuffer = new react_native_buffer.Buffer(salt(passphrase), "utf8");
return react_native_quick_crypto.pbkdf2Sync(
  mnemonicBuffer, saltBuffer, 2048, 64, "sha512"
);
```

注意：Rabby 选了 **patch-package 方案**，OneKey 推荐 **Metro alias 方案**（更优雅，覆盖面更广，不依赖具体库版本）。

### A.4 secp256k1 / BIP32 实现

Rabby 用 [`@rabby-wallet/eth-hd-keyring`](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/package.json)（fork 自 `@metamask/eth-hd-keyring`），内部用 `ethereum-cryptography` (→ `@noble/curves` + `@noble/hashes`)，这些是纯 JS。

BIP32 派生本身不靠 quick-crypto，只有 PBKDF2 / AES 走 native。Rabby 不做高频批量派生（EVM 单链单地址为主），所以 BIP32 性能不是他们的痛点。

---

## 附录 B: MetaMask Mobile 深度调研（已源码验证）

> **结论**：MetaMask Mobile 装了 quick-crypto 但**新 vault 不用**，且**生产环境只跑 5,000 iters**（不是 600k/900k）。他们快**不是因为 native 优化**，是因为**根本没做 OWASP 推荐的密码强化**。
>
> **OneKey 不该参考 MetaMask 的安全配置**（5k iters 比 OneKey 弱 120 倍），但可以参考他们的 backend 切换架构。

### B.1 iterations 常量定义

[`app/core/Encryptor/constants.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/constants.ts)
```ts
export enum KeyDerivationIteration {
  Legacy5000 = 5_000,
  OWASP2023Minimum = 600_000,
  OWASP2023Default = 900_000,
}

export const LEGACY_DERIVATION_OPTIONS = {
  algorithm: 'PBKDF2',
  params: { iterations: KeyDerivationIteration.Legacy5000 },  // 5000
};

export const DERIVATION_OPTIONS_MINIMUM_OWASP2023 = { ... };  // 600k
export const DERIVATION_OPTIONS_DEFAULT_OWASP2023 = { ... };  // 900k
```

### B.2 全仓 `new Encryptor(...)` instantiation 调查（5 处生产 + 1 处测试 UI + 测试文件）

**生产代码（5 处）- 全部用 LEGACY = 5000 iters：**

| # | 文件 | 用途 |
|---|------|-----|
| 1 | [`keyring-controller/keyring-controller-init.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Engine/controllers/keyring-controller/keyring-controller-init.ts) | **主 vault 加密** |
| 2 | [`app/core/SecureKeychain.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/SecureKeychain.ts) | iOS/Android Keychain 凭据 |
| 3 | [`app/util/validators/index.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/util/validators/index.ts) | 验证 vault 格式 |
| 4 | [`snaps/snap-controller-init.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Engine/controllers/snaps/snap-controller-init.ts) | Snaps 加密 |
| 5 | [`seedless-onboarding-controller/index.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Engine/controllers/seedless-onboarding-controller/index.ts) | Seedless 登录 vault |

每处都是：
```ts
const encryptor = new Encryptor({
  keyDerivationOptions: LEGACY_DERIVATION_OPTIONS,   // 5000
});
```

**唯一用 900k 的地方（dev 测试 UI）：**
[`AesCryptoTestForm.tsx`](https://github.com/MetaMask/metamask-mobile/blob/main/app/components/Views/AesCryptoTestForm/AesCryptoTestForm.tsx)
```tsx
const encryptorInstance = new Encryptor({
  keyDerivationOptions: DERIVATION_OPTIONS_DEFAULT_OWASP2023,  // 900k
});
```
这是开发者性能测试表单，普通用户走不到。

**`updateVault` 升级机制**：全仓搜索 `updateVault` 只有 1 个匹配在测试文件注释里，**没有生产代码会把 5000 iters 升级到 OWASP**。

### B.3 quick-crypto 安装但闲置

[`package.json`](https://github.com/MetaMask/metamask-mobile/blob/main/package.json)
```json
"react-native-quick-crypto": "patch:react-native-quick-crypto@npm%3A0.7.15..."
```

[`app/core/Encryptor/lib/index.ts`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/lib/index.ts) 有三个 backend：
- `AesLib` (NativeModules bridge → react-native-aes-crypto)
- `AesForkedLib` (NativeModules bridge → MetaMask 自家 fork)
- `QuickCryptoLib` (JSI → quick-crypto)

但 [`Encryptor.ts:155-160`](https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/Encryptor.ts) 的 `encrypt()` 方法**显式覆盖默认值传 `ENCRYPTION_LIBRARY.original`**（= AesLib，不是 QuickCryptoLib）：
```ts
const key = await this.keyFromPassword(
  password, salt, false, this.keyDerivationOptions,
  ENCRYPTION_LIBRARY.original,   // ← 强制走 NativeModules bridge
);
```

所以 quick-crypto 装了但**新 vault 加密**实际还是走 `react-native-aes-crypto` NativeModules bridge → SpongyCastle Java（Android）/ CommonCrypto C（iOS）。

### B.4 MetaMask 迁移踩坑历史

[Encryptor 目录 commit 历史](https://github.com/MetaMask/metamask-mobile/commits/main/app/core/Encryptor)：
```
2025-12-08: "chore: use native utils for crypto functions"
2025-05-06: "refactor: use react-native-quick-crypto"
2025-02-25: "fix: Revert native HMACSHA512 usage"   ← 原生 HMAC 出 bug 回滚
2024-12-03: "chore: Add eth hd keyring and key tree to decrease unlock time"
```

**MetaMask 在 quick-crypto 迁移上反复 2 年仍未稳定上线**，原因是踩过 native HMAC bug。这是 OneKey 迁移必须做字节级一致性测试 + 灰度回滚的重要参考。

### B.5 react-native-aes-crypto 实现细节（OneKey 也用这个）

Android：[`tectiv3/react-native-aes/.../Aes.java`](https://github.com/tectiv3/react-native-aes/blob/master/android/src/main/java/com/tectiv3/aes/Aes.java)
```java
// pbkdf2 - 纯 Java SpongyCastle
PKCS5S2ParametersGenerator gen = new PKCS5S2ParametersGenerator(algorithmDigest);
gen.init(pwd.getBytes("UTF_8"), salt.getBytes("UTF_8"), cost);
byte[] key = ((KeyParameter) gen.generateDerivedParameters(length)).getKey();

// hmac512 - JCA (实际是 Conscrypt/BoringSSL 原生 C)
Mac sha_HMAC = Mac.getInstance("HmacSHA512");
```

**注意区分**：同一个库里 PBKDF2 是 SpongyCastle Java（慢），HMAC 是 JCA（Conscrypt C，快）。OneKey 的卡顿点是 PBKDF2，不是 HMAC。

iOS：用 CommonCrypto `CCKeyDerivationPBKDF`（真原生 C），所以 iOS 没有这个性能问题。

---

## References (按类别)

### Rabby Mobile（已源码验证的最佳参考）
- quick-crypto install: https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/setup-app.ts
- `@scure/bip39` patch (mnemonicToSeed → quick-crypto) - https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@scure-bip39-npm-1.3.0-1d74c5c469.patch
- `@metamask/browser-passworder` patch (subtle deriveBits → quick-crypto) - https://github.com/RabbyHub/rabby-mobile/blob/develop/.yarn/patches/@metamask-browser-passworder-npm-6.0.0-b3e10a0dba.patch
- keyring service: https://github.com/RabbyHub/rabby-mobile/blob/develop/packages/service-keyring/src/keyringService.ts

### MetaMask Mobile（反面教材 - 不要抄安全配置）
- 主 Encryptor: https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/Encryptor.ts
- backend 选择: https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/lib/index.ts
- 常量定义: https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/constants.ts
- QuickCryptoLib（装了但闲置）: https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Encryptor/lib/quick-crypto.ts
- 主 vault 实例化（LEGACY 5000）: https://github.com/MetaMask/metamask-mobile/blob/main/app/core/Engine/controllers/keyring-controller/keyring-controller-init.ts

### Native library 源码
- quick-crypto C++ PBKDF2 - https://github.com/margelo/react-native-quick-crypto/blob/main/packages/react-native-quick-crypto/cpp/pbkdf2/HybridPbkdf2.cpp
- fastpbkdf2 C 库（SIMD 优化）- https://github.com/ctz/fastpbkdf2
- quick-crypto subtle WebCrypto 实现 - https://github.com/margelo/react-native-quick-crypto/blob/main/packages/react-native-quick-crypto/src/subtle.ts

### SpongyCastle 性能问题溯源
- `react-native-aes-crypto` Android Aes.java (vanilla, SpongyCastle Java pbkdf2) - https://github.com/tectiv3/react-native-aes/blob/master/android/src/main/java/com/tectiv3/aes/Aes.java
- MetaMask `react-native-aes-crypto-forked` Android (同样 SpongyCastle Java) - https://github.com/MetaMask/react-native-aes-crypto-forked/blob/master/android/src/main/java/com/tectiv3/aesforked/RCTAesForked.java
- OneKey 自家 `react-native-pbkdf2` Android (同样 SpongyCastle Java，名为 fast 实际不 fast) - https://github.com/OneKeyHQ/app-modules/tree/main/native-modules/react-native-pbkdf2/android/src/main/java/com/pbkdf2

### 其他钱包对比参考
- Trust Wallet wallet-core（C++ + trezor-crypto）- https://github.com/trustwallet/wallet-core/tree/master/trezor-crypto/crypto
- Uniswap Wallet RNEthersRS（Rust ethers-rs via Swift FFI）- https://github.com/Uniswap/wallet/blob/main/apps/mobile/ios/Uniswap/RNEthersRs/RNEthersRS.swift
- Rainbow react-native-aes fork（5000 iters 硬编码）- https://github.com/rainbow-me/react-native-aes/blob/master/ios/RCTAes/lib/AesCrypt.m
- BlueWallet encryption.ts（crypto-js, 1 iter EVP_BytesToKey）- https://github.com/BlueWallet/BlueWallet/blob/master/blue_modules/encryption.ts
- Edge edge-core-js WebView worker - https://github.com/EdgeApp/edge-core-js/blob/master/src/io/react-native/react-native-worker.ts
