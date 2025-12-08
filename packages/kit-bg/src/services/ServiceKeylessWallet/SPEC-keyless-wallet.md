# Keyless Wallet Spec


## 新建 ServiceKeylessWallet


## ServiceKeylessWallet 支持生成助记词切片

- 随机创建一个 24 位助记词
- 用 sharmirr 秘密分享，拆成 2/3 的 3 个切片：deviceKey、cloudKey、authKey
- 三个切片被封装到三个包装数据内 deviceKeyPack、cloudKeyPack、authKeyPack
- 三个包装数据包含明文数据区和密文数据区，每把 Key 的加密密码都在另外两把 Key 里有备份
- 三个包装数据分别用对应 pwd 来加密密文区，三个 pwdSlice 也是随机生成： deviceKeyPwdSlice、cloudKeyPwdSlice、authKeyPwdSlice
- 实际加密的 pwd 为 pwdSlice + 其他因素一起

规则如下：

DeviceKeyPack

- authKeyPwd:  authKeyPwdSlice + cloudUID + fixedUUID （明文）
- cloudKeyPwd:  cloudKeyPwdSlice + fixedUUID （明文）
- 加密：
  - 生物识别
  - App passcode
  - deviceKeyPwd:  deviceKeyPwdSlice + fixedUUID
- 存储：keychain + DB
  - 切换账户、登出账户是否需要保留 deviceKey
  - 卸载 App 后数据是否保留

```json
// 整体 生物识别 + passcode 加密，keychain 存储，按账户区分
{
  onekeyIdEmail,
  onekeyIdUserId,

  authKeyPwd,
  authKeyPwdHash,
  
  cloudKeyProvider,
  cloudKeyUserIdHash,
  cloudKeyPwd, // 二维码传输不需要这个，或者保留？可以通过插件 + 新手机恢复账户，不需要登录 OneKeyID
  cloudKeyPwdHash,
  
  deviceKeyPwdHash,
  encrypted: { deviceKey } // deviceKeyPwd 加密
}
```

AuthKeyPack

- cloudKeyPwdSlice （整体加密）
- deviceKeyPwdSlice （整体加密）
- 云盘名称 + 云盘账户 Hash： 标识当前 AuthKey 和哪个 CloudKey 对应，用于提示用户登录了错误的云盘
- 存储：
  - 本地内存缓存
  - 服务器安全存储区
- 加密：
  - authKeyPwd:   authKeyPwdSlice + cloudUID + fixedUUID

```json
{
  cloudKeyProvider,
  cloudKeyUserIdHash,
  
  authKeyPwdHash,
  encrypted: { // authKeyPwd 加密
    authKey,
    cloudKeyPwdSlice,
    deviceKeyPwdSlice,
  }
}
```

CloudKeyPack

- authKeyPwdSlice （明文）
  - cloudUID
- deviceKeyPwdSlice （整体加密）
- 加密：
  - cloudKeyPwd:  cloudKeyPwdSlice + fixedUUID
- 存储：
  - 按 OneKeyID 账户分开存储

```json
{
  onekeyIdUserId,
  
  authKeyPwdSlice,
  
  cloudKeyPwdHash,
  encrypted: { // cloudKeyPwd 加密
    cloudKey, 
    deviceKeyPwdSlice,
  }
}
```


