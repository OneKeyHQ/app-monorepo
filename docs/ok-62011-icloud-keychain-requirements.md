# OK-62011：iOS 本机快捷解密 iCloud 备份

需求：[OK-62011](https://onekeyhq.atlassian.net/browse/OK-62011)。按讨论最终确认的“仅本机快捷解密，新设备先手输一次”实施。更新日期：2026-09-16。

## 范围与存储

仅接入 iOS 的 Cloud Backup V2 / iCloud 恢复。Google Drive、macOS、Android、Web、Extension 保留原有手输流程。

| 数据 | 存储位置 | 约束 |
| --- | --- | --- |
| 32 字节随机密钥 | 现有 `secureStorage`，条目 `com.onekey.backup_v2.local_password.key` | 原生适配器使用 `WHEN_UNLOCKED_THIS_DEVICE_ONLY`，不参与 iCloud Keychain 同步，不迁移到新设备 |
| 备份密码密文 | `simpleDb.cloudBackupPasswordCache` | 复用现有 v2 认证加密封装；AAD 绑定缓存版本、CloudKit 用户 ID、备份 recordId；SimpleDB 不保存明文密码或密钥 |
| 已解密的恢复数据 | bg 内存 | 最多保留一份，60 秒过期，通过一次性随机凭证消费；UI 只收到凭证和恢复是否成功 |

现有同步条目 `com.onekey.backup_v2.encryption.key` 保持原值且不参与本机缓存。云端备份及密码验证记录的字段、加密格式、`buildFullBackupPassword` 构造规则均不变，也不新增 CloudKit 密码缓存记录。

SimpleDB 新增实体，无 Realm/IndexedDB schema 变更，不需要提升 `LOCAL_DB_VERSION`。缓存 key 含版本号，无法读取或解密的缓存视为未命中。

## 密码更新与恢复流程

- 设置/修改当前备份密码成功、验证当前备份密码成功：更新该账号的“当前密码”密文。
- 新备份完成上传与回读校验：保存该备份 recordId 的密码密文。
- 手动恢复或导出成功解密：更新对应 recordId 的密码密文。历史备份的旧密码不会覆盖当前密码槽。
- 本机恢复先试对应记录，再试当前密码；必须实际解密选中的备份。缓存密码不能解密该备份时清除对应记录缓存；当前密码若无法解密历史备份则保留。
- 无缓存、Keychain 被锁定/不可读、密钥丢失、缓存损坏或密码不匹配：直接回到原有手输，不提前弹密码错误或备份损坏提示。自动读取不会生成或替换设备密钥。
- 手输验证成功后可建立/修复缓存；初始化由 bg 的互斥锁串行化，写入 Keychain 后回读确认才持久化密码密文。缓存读写失败不影响已成功的主流程。
- UI 拿到一次性恢复凭证后进入原有导入流程；后台消费前检查有效期和当前 iCloud 账号，仍执行原有本地密码授权。授权取消与真实导入错误直接结束本次操作，不当作缓存失败重试。
- 删除备份成功后尽力删除对应本地缓存；清除备份密码成功后删除当前密码槽。保留其他备份的历史密码及设备密钥。

## 平台和安全边界

iOS 的 main 与 bg 是独立初始化的 JS runtime；系统 Keychain 是共享原生资源。本功能的安全存储访问、密钥初始化、缓存加解密和恢复数据均由 bg 负责，main 不创建密钥。手输密码仍会短暂存在于 main 和 bg，缓存恢复得到的密码不会通过新增 RPC 返回给 main。SimpleDB 密文由 bg 单写，未增加 main 的明文数据副本。

仅得到 iCloud 云备份不足以获得本功能保存的设备密钥；即使应用本地文件通过系统备份/迁移出现在新设备上，也不能仅凭缓存密文完成快捷解密。该设计仍依赖设备自身与系统 Keychain 的安全性，不代表能抵御已完全控制原设备的攻击者。用户仍需保留备份密码用于新设备或缓存不可用时恢复。

iOS 的 CloudKit 可用性检查不再依赖 iCloud Keychain 同步开关，账号信息也不调用同步检测接口。CloudKit 不可用仍按原有流程阻止云备份操作；macOS 原有检查保持不变。

## 验证

自动化测试覆盖：真实缓存加解密与 AAD 绑定、密文篡改、密钥缺失模拟换机、并发初始化、缓存读写失败、修改密码和历史备份隔离、恢复凭证过期及账号切换、本地授权取消、导入失败、缓存命中/手输回退的界面调用顺序、Google Drive 原流程以及原有备份导出兼容性。

本次验证：`yarn agent:check --profile commit` 全部通过（含 lint、格式、TypeScript、后台接口约束）；7 组定向 Jest 测试共 35 项通过，包含新增缓存/恢复/界面测试及既有导出、SimpleDB 契约回归。

这些是单元与流程回归测试；尚未在真实 iPhone 上验证 Keychain 锁定、系统迁移及实际 iCloud 账号恢复。
