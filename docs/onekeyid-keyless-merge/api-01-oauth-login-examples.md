# API-01 `POST /prime/v1/account/oauth/login` Examples

本文档是 [server-apis.md](./server-apis.md) 中 API-01 `POST /prime/v1/account/oauth/login` 的示例补充。主接口文档保留类型、枚举和规则；具体场景请求 / 响应示例集中放在这里。

## API-01 / Example 01. 已绑定 Google identity 正常登录

Request:

```json
{
  "token": "supabase-access-token"
}
```

Response:

```json
{
  "status": "success",
  "onekeySession": {
    "accessToken": "onekey-access-token",
    "refreshToken": "onekey-refresh-token"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_A",
    "status": "active",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "oauthProvider": "google",
        "oauthSubject": "108204857102938475610",
        "oauthEmailType": "real",
        "oauthEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_google_1082048571",
    "oauthProvider": "google",
    "oauthSubject": "108204857102938475610",
    "oauthEmailType": "real",
    "oauthEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_A",
    "bindReason": "existing_oauth_binding"
  }
}
```

## API-01 / Example 02. 未绑定 Google identity，verified email 命中 legacy OneKeyID

用户以前用 `neo@gmail.com` 注册过 legacy OneKeyID；现在首次用同邮箱 Google 登录。

Request:

```json
{
  "token": "supabase-access-token"
}
```

Response:

```json
{
  "status": "success",
  "onekeySession": {
    "accessToken": "onekey-access-token",
    "refreshToken": "onekey-refresh-token"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_legacy_A",
    "status": "active",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "legacy_email",
        "legacyEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      },
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "oauthProvider": "google",
        "oauthSubject": "108204857102938475610",
        "oauthEmailType": "real",
        "oauthEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_google_1082048571",
    "oauthProvider": "google",
    "oauthSubject": "108204857102938475610",
    "oauthEmailType": "real",
    "oauthEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_email_auto_bind"
  }
}
```

## API-01 / Example 03. 未绑定 Apple identity，verified email 命中已有 email claim owner

用户已经用 `neo@gmail.com` 的 Google OAuth 创建了 OneKeyID；服务端为 `neo@gmail.com` 建立了 active email claim，owner 是 `onekey_A`。现在用户首次用同邮箱 Apple 登录，当前 Apple OAuth identity 还没有 binding，但它返回了相同 verified `normalizedEmail`，所以服务端通过 email claim 自动绑定到 `onekey_A`。

Request:

```json
{
  "token": "supabase-access-token"
}
```

Response:

```json
{
  "status": "success",
  "onekeySession": {
    "accessToken": "onekey-access-token",
    "refreshToken": "onekey-refresh-token"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_A",
    "status": "active",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "oauthProvider": "google",
        "oauthSubject": "108204857102938475610",
        "oauthEmailType": "real",
        "oauthEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      },
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_apple_0009876543",
        "oauthProvider": "apple",
        "oauthSubject": "000987.654321.apple-user",
        "oauthEmailType": "real",
        "oauthEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_apple_0009876543",
    "oauthProvider": "apple",
    "oauthSubject": "000987.654321.apple-user",
    "oauthEmailType": "real",
    "oauthEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_A",
    "bindReason": "email_claim_auto_bind"
  }
}
```

## API-01 / Example 04. 未命中任何 legacy / email claim，创建新的 OAuth OneKeyID

Request:

```json
{
  "token": "supabase-access-token"
}
```

Response:

```json
{
  "status": "success",
  "onekeySession": {
    "accessToken": "onekey-access-token",
    "refreshToken": "onekey-refresh-token"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_new_A",
    "status": "active",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "oauthProvider": "google",
        "oauthSubject": "108204857102938475610",
        "oauthEmailType": "real",
        "oauthEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_google_1082048571",
    "oauthProvider": "google",
    "oauthSubject": "108204857102938475610",
    "oauthEmailType": "real",
    "oauthEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_new_A",
    "bindReason": "new_oauth_account_created"
  }
}
```

## API-01 / Example 05. Apple 未返回 verified email，创建 OAuth-only OneKeyID

Request:

```json
{
  "token": "supabase-access-token"
}
```

Response:

```json
{
  "status": "success",
  "onekeySession": {
    "accessToken": "onekey-access-token",
    "refreshToken": "onekey-refresh-token"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_oauth_only_A",
    "status": "active",
    "identities": [
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_apple_0009876543",
        "oauthProvider": "apple",
        "oauthSubject": "000987.654321.apple-user",
        "oauthEmailType": "missing_or_unverified"
      }
    ]
  },
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_apple_0009876543",
    "oauthProvider": "apple",
    "oauthSubject": "000987.654321.apple-user",
    "oauthEmailType": "missing_or_unverified"
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_oauth_only_A",
    "bindReason": "new_oauth_account_created"
  }
}
```

## API-01 / Example 06. OAuth binding 指向 merged source，返回错误

Response:

```json
{
  "code": "account_merged_reauth_required",
  "message": "OAuth binding requires account re-authentication.",
  "data": {
    "oauthIdentityId": "hash_google_1082048571",
    "oauthProvider": "google"
  }
}
```

客户端处理：清理本地 OneKeyID Supabase session / `primePersistAtom`，不要继续使用 source 旧 session，也不要在客户端把 source 透明切到 target。报错并回到登录界面，让用户手动重新发起 Google / Apple 登录；客户端不能自动重试或自动重新调用本接口，避免服务端持续返回同一错误时进入循环。若用户手动重登后仍返回该错误或 `support_required`，展示客服处理入口。

## API-01 / Example 07. 合并 / 绑定数据异常，返回 `support_required`

当前方案不引入单独的账号锁定状态。普通登录、OAuth 自动绑定、显式合并、Email OTP 等在线流程发现无法自动处理的数据异常时，统一返回 `support_required`，含义是合并 / 绑定流程需要客服处理。

Response:

```json
{
  "code": "support_required",
  "message": "Account state requires support review.",
  "data": {
    "reason": "duplicate_legacy_email",
    "displayEmail": "n***@gmail.com"
  }
}
```

客户端处理：不写入 `onekeySession`，不设置 `isLoggedInOnServer = true`，不创建新 OneKeyID，不进入普通登录态，也不自动选择某个 target。清理本次登录过程中产生的临时 OneKeyID 状态，展示客服处理入口；用户处理完成后再重新发起 OAuth 登录。
