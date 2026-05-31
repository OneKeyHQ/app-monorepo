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

## API-03 / Example 03. OAuth email 与 legacy email OneKeyID email 不同，body 双 token 授权绑定成功

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

## API-03 / Example 04. Apple private relay OAuth identity，body 双 token 授权绑定成功

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

客户端处理：不能把该 OAuth identity 通过 API-03 强行绑定或转移到 `legacyOneKeyIdAuthToken` 对应的 legacy email OneKeyID。如果用户要把这个 OAuth identity 从 OneKeyID A 转移到 legacy email OneKeyID B，必须走 API-04 / API-05 / API-06 的显式账号合并流程，最终由 API-06 `/merge/confirm` 改写 binding；也可以提示用户切换账号或联系支持。
