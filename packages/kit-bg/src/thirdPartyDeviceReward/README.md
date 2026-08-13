# thirdPartyDeviceReward — ⚠️ 临时寄居,未来迁移

这个文件夹里的东西**现在跑在 app-monorepo,但逻辑最终不属于这里**。集中放在一起,是为了让任何人一眼知道:这是要搬走的。

## 未来去向

| 子目录 | 现在做什么 | 未来搬到哪 |
| --- | --- | --- |
| `client/` | 领券的 challenge / claim 调用 | **留在 app**,但实现从"本地模拟"切成"调后端"。调用方不变。 |
| `deviceComm/` | 与 Trezor / Ledger 通信做真机验真 | **归 SDK**(hardware-js-sdk)。app 只保留调用。 |
| —(逻辑) | 验真裁决 + 发券 | **归后端**(OneKey Rebate Server)。现在 `LocalMockDeviceRewardClient` 是它的原型。 |

## 一条链,不是两种模式

```
① client.createChallenge()      → 拿到 challenge(含要签名的 addressMessage、ledgerRelay)
② deviceComm.verifyAuthenticity → 真机验真,产出 evidence(Trezor 证书链 / Ledger sessionId)
③ 钱包账户对 addressMessage 签名
④ client.claim(challengeId, addressSignature, evidence, inviteCode?)
                                → 后端裁决:验真结论 + 挑战有效 + 地址签名 + 是否已领 → 发不发券
```

`client` 只管 ①④(跟后端说话),`deviceComm` 只管 ②(跟设备说话)。两者不互相依赖。

## 统一点:IDeviceRewardClient

`ServerDeviceRewardClient` 已实现该接口(转发到 ServiceReferralCode 的 challenge/claim)。
未来用服务端 = **换一个实现,上层代码不动**。

### ⚠️ 本地 mock 跟这个接口对不齐(待决策)

现有的 `runTrustedLocalMockDeviceClaim`(在 ServiceThirdPartyHardware)**不是**这个接口的
另一个实现 —— 它和服务端的信任边界不同:

| | 本地 mock | 服务端(本接口) |
| --- | --- | --- |
| challenge | 本地一个 hex 串 | 含 addressMessage / ledgerRelay 的对象 |
| 地址签名 | 无 | 必须签 addressMessage |
| claim 收的证据 | `{verified, deviceId}`(已验过的结果) | 原始证据(证书链),服务器自己验 |
| 验真发生在 | app 侧(SDK 已验) | 服务器侧 |

mock 的真正接缝在 `executeAuthenticityCheck`(设备验真那层),不在 client 层。

两条路:
- **要 mock 真正实现本接口** → 把 mock 重塑成三步(createChallenge 本地造对象、
  claim 本地验原始证据 + 发券)。这是重塑,不是搬代码。
- **mock 只当 dev 捷径** → 不进本抽象,接口只有 `ServerClient` +(未来)一个测试实现。
  mock 留在 ServiceThirdPartyHardware 原地。

## 不在这里的东西

账户名迁移(读 Ledger Live / Trezor Suite 本地文件)**不属于这个文件夹** —— 它天生是桌面 app 侧的,不搬。别混进来。

## 现状(草案阶段)

- `IDeviceRewardClient` 接口 ✅
- `ServerDeviceRewardClient` ✅(转发到 ServiceReferralCode,类型 0 错误)
- `LocalMockDeviceRewardClient` ⏸ 等上面"本地 mock 对不齐"的决策再写
- 真实逻辑仍散在 `ServiceThirdPartyHardware`(设备通信 + 本地模拟)和
  `ServiceReferralCode`(服务端 challenge/claim),**尚未搬入**。
- 草案阶段一律不动现有代码。真正搬入 = 逻辑进 client、Service 方法改成转发,那步才动现有代码。
