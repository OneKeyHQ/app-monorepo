# Onboarding v2 Redesign - Design Spec

> Deadline: **2026-04-24（周五）**
> Status: Design spec 已落地，评审前待定稿

## 核心战略

首屏从"硬件钱包品牌入口"转向"通用钱包入口"。

首屏三按钮分层：
- **Primary** = `Create new wallet`
- **Secondary** = `Add existing wallet`
- **Tertiary** = `Connect hardware wallet`（从当前 primary 降级）

**依据**：数据显示 90.2% 添加钱包用户是纯软件用户，86% 硬件入口点击为误点。详见 [data-analysis.md](data-analysis.md)。

## 关键设计决策

### 1. 首屏 Hero 结构："句式骨架 + 轮换变量"

- 第一行（固定）+ 第二行（7 词轮换，加粗，slot machine 动效）
- 轮换词 = trading / swapping / staking / perps / buying / DeFi / everything
- 词源 1:1 对应 onekey.so 的 section titles（评审论据：marketing 已审）
- 有意排除 "Cold Wallet" 和 "Protection" section（与削弱硬件战略冲突）

### 2. 二级页 Add existing wallet：两组结构

- **Group 1**（无 title，3 项）：Google / Apple / Import phrase or private key
- **More ways**（6 项）：Transfer / iCloud / Lite / KeyTag / 3rd-party / Watch
- Transfer 需加副文本 "Requires another OneKey device"

### 3. 二级页 Create new wallet：3 选项

- Continue with Google（Keyless）
- Continue with Apple（Keyless）
- Create a recovery phrase（传统）
- Hero: `Go keyless. Security without the seed phrase.`（官网原句）

### 4. 大屏 Layout

两栏方向已定（左 hero 右 actions），细节待后续 iteration。

## Open Questions（评审待决策）

- **Q1 核心未决**：Hero 第一行用 `Your most secure crypto wallet for`（品牌一致但战略冲突，Franco 倾向此选）vs `Your universal crypto wallet for`（战略匹配）。Franco 在最新 mockup 里保留了 `most secure`，但明确是 open question，评审会决策
- **Q2**：Tertiary 硬件按钮样式（outline button vs plain text link）—— Franco 说"按钮样式先不管"
- **Q3**：大屏两栏 layout 细化
- **Q4**：3rd-party wallet 副文本是否加 `Including your OneKey Mobile`（数据：46% 第三方连接实际是 OneKey 自家设备）

## 改版前必做的埋点修复（1-2 天工作量）

缺了这 3 处，改版效果无法用数据证明：

1. **GetStarted.tsx 的 Google/Apple 直登未调用 `addWalletStarted`** — 导致 Keyless 启动量 552 严重失真，真实 ~7,000+
2. **v2 OnboardingLayout.tsx 没有 page view / back / exit 埋点** — 用户在哪一步流失不可知
3. **wallet.ts 里 `details.importType` 等嵌套对象在 Mixpanel breakdown 返回 undefined** — 需展平

## Franco 的设计判断倾向（本项目观察）

- 重视官网品牌一致性（导致他倾向保留 `most secure` 即便战略冲突）
- 喜欢"功能点轮播"超过"静态 brand 宣言"（参考了 Fuse Wallet 设计）
- 希望 hero 和官网每个 section title 对齐，让 marketing 已审文案被复用
- 对按钮细节（outline vs link）暂不纠结，先看整体方向
- 通过 Figma 截图快速 iterate，希望即时 UX 反馈
- 改版核心 OKR：降低硬件入口流量 + 提升 Keyless 转化。**不追求 backup 完成率**（backup 不算 onboarding）
