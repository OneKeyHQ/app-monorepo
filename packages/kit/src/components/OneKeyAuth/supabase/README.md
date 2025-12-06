# Init Project

- [Create Api Key](https://supabase.com/dashboard/project/xxxxxxxx/settings/api-keys/new)
- [Enable Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless#enabling-email-otp)
  - [修改邮件模版支持 OTP](https://supabase.com/dashboard/project/xxxxxxxx/auth/templates)
    - Confrim sign up: 首次注册的模版
    - Magic link: 第二次登录模版
- OTP 暴力破解防护 TODO
  - https://supabase.com/dashboard/project/wtspqckturkzhstyjabx/auth/protection
  - https://supabase.com/docs/guides/auth/rate-limits
  - https://supabase.com/dashboard/project/wtspqckturkzhstyjabx/auth/rate-limits
  - Supabase Auth Hooks
- 客户端伪造钓鱼攻击 TODO
- 域名白名单 TODO
- email 登录 redirect 域名约束
- 

# Errors

https://supabase.com/docs/guides/auth/debugging/error-codes

限频

```json
{
    "data": {
        "user": null,
        "session": null
    },
    "error": {
        "__isAuthError": true,
        "name": "AuthApiError",
        "status": 429,
        "code": "over_email_send_rate_limit"
    }
}
```

OTP 已发送

```json
{
    "data": {
        "user": null,
        "session": null
    },
    "error": null
}
```

OTP 不正确

```json
{
    "data": {
        "user": null,
        "session": null
    },
    "error": {
        "__isAuthError": true,
        "name": "AuthApiError",
        "status": 403,
        "code": "otp_expired"
    }
}
```

OTP 登录成功

```json
{
    "data": {
        "user": {
            "id": "d01ea01a-839b-4aa5-864e-e5caad815a27",
            "email": "dev-fe@onekey.so",
        },
        "session": {
            "access_token": "...",
            "token_type": "bearer",
            "expires_in": 3600,
            "expires_at": 1761818996,
            "refresh_token": "d7mcrnc45b4m",
            "user": {
                "id": "d01ea01a-839b-4aa5-864e-e5caad815a27",
                "email": "dev-fe@onekey.so",
            }
        }
    },
    "error": null
}
```

项目已经删除，需要有主动清空 storage 机制，否则用户无法登出和重新登录
项目 APIKey 不正确

```json
{
    "data": {
        "user": null
    },
    "error": {
        "__isAuthError": true,
        "name": "AuthRetryableFetchError",
        "status": 0
    }
}
```

storage 清空后，尝试获取 user 报错

```json
{
    "data": {
        "user": null
    },
    "error": {
        "__isAuthError": true,
        "name": "AuthSessionMissingError",
        "status": 400
    }
}
```

# 迁移 Privy 数据、渐进式上线方案

- privy 用户迁移
  - 批量获取已注册的 privy 用户
  - 批量创建 supabase 用户
  - 记录 privyUserId 和 onekeyUserId 映射关系
- revenueCat 订购权益数据迁移
  - 服务器更新 revenueCat 已订阅的用户 id（privyId->supabaseId）
- 云端同步、邀请返佣等相关数据迁移
- 旧版客户端登录时，强制提示升级



# 各个端支持情况

- [X] web
- [X] 插件
- [X] Desktop 本地
- [ ] Desktop 生产
- [X] iOS
- [ ] Android

# TODO

- ~~登录界面调用 supabase~~
- ~~移出 privy provider~~
- SupabaseAuthContext 改成 jotai global 存储
- supabase hooks 需要实现 isReady，断网情况下，isReady 确保工作
- 发送验证码需限频报错，目前是提示成功并进入验证码倒计时
  - 发送验证码接口 loading，按钮需要 loading 效果
- 验证码输入错误，目前直接成功登录，需要提示错误
- 封装 api 自动 throw error
- ~~useOneKeyID~~

# Privy 接口下线

- 服务器 login、返佣、云端同步、prime 接口报错，确保客户端能提示 Error Toast，提示用户升级
- 服务器返回 Error，能触发客户端升级提醒


# 服务器数据迁移

privyUserId -> onekeyUserId 



# RevenueCat 数据迁移

## 客户端动态迁移，同时保证新旧版本客户端获取订阅状态

```
await Purchases.configure({ ..., appUserID: privyUserId });
await Purchases.logIn(onekeyUserId);
```
