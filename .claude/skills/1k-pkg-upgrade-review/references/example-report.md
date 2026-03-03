# @isaacs/brace-expansion 5.0.0 -> 5.0.1 升级分析

> PR: https://github.com/OneKeyHQ/app-monorepo/pull/9989
> 生成时间: 2026-02-04

---

## 一、代码差异

### 1.1 新增导出

```javascript
// 新增常量
export const EXPANSION_MAX = 100_000;

// 新增类型
export type BraceExpansionOptions = {
  max?: number; // 默认 100_000
};
```

### 1.2 函数签名变更

```diff
- export function expand(str: string): string[];
+ export declare const EXPANSION_MAX = 100000;
+ export type BraceExpansionOptions = {
+     max?: number;
+ };
+ export function expand(str: string, options?: BraceExpansionOptions): string[];
```

新增可选参数 `options`，默认值为 `{}`，其中 `max` 默认为 `100_000`。

### 1.3 核心逻辑变更

内部递归函数 `expand_()` 签名从 `(str, isTop)` 变为 `(str, max, isTop)`，所有递归调用点均传递 `max` 参数。

**限制逻辑 1** -- 逗号分隔展开的 post 循环：

```diff
- for (let k = 0; k < post.length; k++) {
+ for (let k = 0; k < post.length && k < max; k++) {
```

**限制逻辑 2** -- 最终展开结果的 post 循环：

```diff
- for (let k = 0; k < post.length; k++) {
+ for (let k = 0; k < post.length && expansions.length < max; k++) {
```

### 1.4 完整 diff (commonjs/index.js)

```diff
+exports.EXPANSION_MAX = void 0;
+exports.EXPANSION_MAX = 100_000;

-function expand(str) {
+function expand(str, options = {}) {
+    const { max = exports.EXPANSION_MAX } = options;
-    return expand_(escapeBraces(str), true).map(unescapeBraces);
+    return expand_(escapeBraces(str), max, true).map(unescapeBraces);

-function expand_(str, isTop) {
+function expand_(str, max, isTop) {
-    const post = m.post.length ? expand_(m.post, false) : [''];
+    const post = m.post.length ? expand_(m.post, max, false) : [''];
-        for (let k = 0; k < post.length; k++) {
+        for (let k = 0; k < post.length && k < max; k++) {
-                return expand_(str);
+                return expand_(str, max, true);
-                n = expand_(n[0], false).map(embrace);
+                n = expand_(n[0], max, false).map(embrace);
-                N.push.apply(N, expand_(n[j], false));
+                N.push.apply(N, expand_(n[j], max, false));
-            for (let k = 0; k < post.length; k++) {
+            for (let k = 0; k < post.length && expansions.length < max; k++) {
```

### 1.5 其他变更

| 文件 | 变更 |
|------|------|
| `package.json` | 版本号 5.0.0 -> 5.0.1，移除内联 prettier 配置，升级 `tap` 到 `^21.5.0` |
| `README.md` | 新增 `max` 选项文档说明 |

### 1.6 安全意义

在 5.0.0 中，类似 `'{1..100}'.repeat(5)` 的输入会产生 100^5 = 10,000,000,000 个展开结果，可导致内存耗尽和进程挂起。5.0.1 通过默认 100,000 上限阻止了这种 DoS 攻击向量。

---

## 二、项目中的调用位置

### 2.1 项目源码

**无直接引用。** 在整个 monorepo 源码中（排除 `node_modules`），未找到任何对 `@isaacs/brace-expansion` 的直接 import/require，也未找到对 `braceExpand`、`brace_expansion` 等相关标识符的使用。

### 2.2 node_modules 中的间接调用方

整个 monorepo 中仅有 **2 个位置** 通过 `minimatch@10.1.1` 间接调用了 `expand()`：

#### 调用方 1: app-builder-lib (Electron 构建工具)

- **文件**: `node_modules/app-builder-lib/node_modules/minimatch/dist/commonjs/index.js:157`
- **文件**: `node_modules/app-builder-lib/node_modules/minimatch/dist/esm/index.js:151`
- **minimatch 版本**: 10.1.1
- **依赖声明**: `"@isaacs/brace-expansion": "^5.0.0"`

```javascript
// commonjs/index.js:157
return (0, brace_expansion_1.expand)(pattern);

// esm/index.js:151
return expand(pattern);
```

**用途**: Electron 构建时的文件匹配（`extraResources`、`files` 等配置）。

#### 调用方 2: expo-splash-screen

- **文件**: `node_modules/expo-splash-screen/node_modules/minimatch/dist/commonjs/index.js:157`
- **文件**: `node_modules/expo-splash-screen/node_modules/minimatch/dist/esm/index.js:151`
- **minimatch 版本**: 10.1.1
- **依赖声明**: `"@isaacs/brace-expansion": "^5.0.0"`

```javascript
// commonjs/index.js:157
return (0, brace_expansion_1.expand)(pattern);

// esm/index.js:151
return expand(pattern);
```

**用途**: Splash screen 资源文件匹配。

### 2.3 调用方式汇总

| 调用方 | 调用代码 | 参数数量 | 是否使用 options |
|--------|----------|----------|------------------|
| app-builder-lib/minimatch | `expand(pattern)` | 1 | 否 |
| expo-splash-screen/minimatch | `expand(pattern)` | 1 | 否 |

所有调用方均只传递 1 个参数（`pattern`），未使用新增的 `options` 参数。

### 2.4 安装位置

| 位置 | 版本 | 说明 |
|------|------|------|
| 根 `node_modules/@isaacs/brace-expansion` | 5.0.0 | 当前 hoisted 版本 |
| `apps/desktop/app/node_modules/` | 不存在 | 使用根 hoisted 版本 |

此 PR 仅修改 `apps/desktop/app/yarn.lock`，实际升级在 desktop app 独立 install 时生效。

---

## 三、兼容性评估

| 变更项 | 5.0.0 | 5.0.1 | 兼容性 |
|--------|-------|-------|--------|
| 函数签名 | `expand(str)` | `expand(str, options?)` | 完全兼容 -- 新参数可选 |
| 返回值类型 | `string[]` | `string[]` | 无变化 |
| 返回值内容 | 无上限 | 最多 100,000 个 | 正常场景无影响 |
| 新增导出 `EXPANSION_MAX` | 无 | `100_000` | 不影响现有代码 |
| 新增类型 `BraceExpansionOptions` | 无 | `{ max?: number }` | 不影响现有代码 |

### 返回值截断风险

5.0.1 默认上限为 100,000 个展开结果。两个调用方的使用场景：

- **app-builder-lib**: glob 模式为简单文件路径如 `**/*.js`，不可能触发上限
- **expo-splash-screen**: 资源文件匹配模式极其简单，不可能触发上限

**结论: 此升级完全安全，不会对项目产生任何负面影响。**
