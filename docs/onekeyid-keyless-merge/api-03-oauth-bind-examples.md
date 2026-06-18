# API-03 `POST /prime/v1/account/identities/oauth/bind` Examples

本文档是 [server-apis.md](./server-apis.md) 中 API-03 `POST /prime/v1/account/identities/oauth/bind` 的示例补充。主接口文档保留类型、枚举和规则；具体场景请求 / 响应示例集中放在这里。

## API-03 / Example 01. OAuth identity 已绑定到 legacy email OneKeyID，幂等返回成功

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "legacyOneKeyIdAuthToken": "legacy-onekeyid-access-token"
}
```

Response:

```json
{
  "status": "success",
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
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "existing_oauth_binding"
  }
}
```

## API-03 / Example 02. legacy email OneKeyID 与 OAuth verified email 相同，静默绑定成功

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "legacyOneKeyIdAuthToken": "legacy-onekeyid-access-token"
}
```

Response:

```json
{
  "status": "success",
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
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_email_auto_bind"
  }
}
```

## API-03 / Example 03. OAuth email 与 legacy email OneKeyID email 不同，双 token 授权绑定成功

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "legacyOneKeyIdAuthToken": "legacy-onekeyid-access-token"
}
```

Response:

```json
{
  "status": "success",
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_google_2099999999",
    "oauthProvider": "google",
    "oauthSubject": "209999999900000000000",
    "oauthEmailType": "real",
    "oauthEmail": "neo.work@gmail.com",
    "normalizedEmail": "neo.work@gmail.com",
    "displayEmail": "n***@gmail.com"
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
        "oauthIdentityId": "hash_google_2099999999",
        "oauthProvider": "google",
        "oauthSubject": "209999999900000000000",
        "oauthEmailType": "real",
        "oauthEmail": "neo.work@gmail.com",
        "normalizedEmail": "neo.work@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_session_authorized_bind"
  }
}
```

客户端处理：用户已经同时持有 `legacyOneKeyIdAuthToken` 和 OAuth token，服务端确认该 OAuth identity 未绑定到其他 OneKeyID 后直接绑定到当前 legacy email OneKeyID。不要求 OAuth email 与 legacy email 相同。

## API-03 / Example 04. Apple private relay OAuth identity，双 token 授权绑定成功

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "legacyOneKeyIdAuthToken": "legacy-onekeyid-access-token"
}
```

Response:

```json
{
  "status": "success",
  "oauthIdentity": {
    "identityType": "oauth",
    "oauthIdentityId": "hash_apple_000998877",
    "oauthProvider": "apple",
    "oauthSubject": "000998877.apple.user",
    "oauthEmailType": "apple_private_relay",
    "oauthEmail": "abc123@privaterelay.appleid.com",
    "normalizedEmail": "abc123@privaterelay.appleid.com",
    "displayEmail": "a***@privaterelay.appleid.com",
    "oauthRelayDomainMatched": "privaterelay.appleid.com"
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
        "oauthIdentityId": "hash_apple_000998877",
        "oauthProvider": "apple",
        "oauthSubject": "000998877.apple.user",
        "oauthEmailType": "apple_private_relay",
        "oauthEmail": "abc123@privaterelay.appleid.com",
        "normalizedEmail": "abc123@privaterelay.appleid.com",
        "displayEmail": "a***@privaterelay.appleid.com",
        "oauthRelayDomainMatched": "privaterelay.appleid.com"
      }
    ]
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_session_authorized_bind"
  }
}
```

客户端处理：Apple private relay 也可以在 API-03 双 token proof 下绑定到当前 legacy email OneKeyID。没有 verified email 的 OAuth identity 同理可以绑定；区别是服务端只写 OAuth binding，不创建 email claim。

## API-03 / Example 05. OAuth identity 已绑定到另一个 OneKeyID，返回错误

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "legacyOneKeyIdAuthToken": "legacy-onekeyid-access-token"
}
```

Response:

```json
{
  "code": "oauth_identity_bound_to_another_account",
  "message": "OAuth identity is already bound to another OneKeyID.",
  "data": {
    "oauthIdentityId": "hash_google_1082048571",
    "oauthProvider": "google"
  }
}
```

客户端处理：不能把该 OAuth identity 通过 API-03 强行绑定或转移到 `legacyOneKeyIdAuthToken` 对应的 legacy email OneKeyID。API-03 只返回 `oauth_identity_bound_to_another_account`；客户端应提示该 OAuth identity 已被其他 OneKeyID 使用，并停止本次绑定。不能在 API-03 内自动登录其他 OneKeyID、转移 binding 或继续 merge。
