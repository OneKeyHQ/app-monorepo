# API-03 `POST /prime/v1/account/identities/oauth/bind` Examples

本文档是 [onekeyid-keyless-unified-login-server-apis.md](./onekeyid-keyless-unified-login-server-apis.md) 中 API-03 `POST /prime/v1/account/identities/oauth/bind` 的示例补充。主接口文档保留类型、枚举和规则；具体场景请求 / 响应示例集中放在这里。

## API-03 / Example 01. OAuth identity 已绑定到当前 OneKeyID，幂等返回成功

Request Header:

```http
X-Onekey-Request-Token: onekey-access-token
```

Request Body:

```json
{
  "token": "supabase-oauth-access-token"
}
```

Response:

```json
{
  "status": "success",
  "oauthIdentity": {
    "oauthIdentityId": "hash_google_1082048571",
    "provider": "google",
    "providerSubject": "108204857102938475610",
    "providerEmailType": "real",
    "providerVerifiedEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_legacy_A",
    "status": "active",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "legacy_email",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      },
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "provider": "google",
        "providerSubject": "108204857102938475610",
        "providerEmailType": "real",
        "providerVerifiedEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "existing_oauth_binding"
  },
  "oauthBindVerification": null
}
```

## API-03 / Example 02. 当前 legacy OneKeyID 与 OAuth verified email 相同，静默绑定成功

Request Header:

```http
X-Onekey-Request-Token: onekey-access-token
```

Request Body:

```json
{
  "token": "supabase-oauth-access-token"
}
```

Response:

```json
{
  "status": "success",
  "oauthIdentity": {
    "oauthIdentityId": "hash_google_1082048571",
    "provider": "google",
    "providerSubject": "108204857102938475610",
    "providerEmailType": "real",
    "providerVerifiedEmail": "neo@gmail.com",
    "normalizedEmail": "neo@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_legacy_A",
    "status": "active",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "legacy_email",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      },
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_1082048571",
        "provider": "google",
        "providerSubject": "108204857102938475610",
        "providerEmailType": "real",
        "providerVerifiedEmail": "neo@gmail.com",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_email_auto_bind"
  },
  "oauthBindVerification": null
}
```

## API-03 / Example 03. OAuth email 与当前 legacy email 不同，返回 `legacy_email_otp_required`

Request Header:

```http
X-Onekey-Request-Token: onekey-access-token
```

Request Body:

```json
{
  "token": "supabase-oauth-access-token"
}
```

Response:

```json
{
  "status": "legacy_email_otp_required",
  "oauthIdentity": {
    "oauthIdentityId": "hash_google_2099999999",
    "provider": "google",
    "providerSubject": "209999999900000000000",
    "providerEmailType": "real",
    "providerVerifiedEmail": "neo.work@gmail.com",
    "normalizedEmail": "neo.work@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_legacy_A",
    "status": "active",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "legacy_email",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentityBinding": null,
  "oauthBindVerification": {
    "oauthBindVerificationHandle": "signed-oauth-bind-verification-handle",
    "requiredVerification": ["legacy_email_otp"],
    "otpScene": "ManualOAuthBind",
    "targetOneKeyUserId": "onekey_legacy_A",
    "targetDisplayEmail": "n***@gmail.com",
    "oauthDisplayEmail": "n***@gmail.com",
    "reason": "oauth_email_mismatch",
    "expiresAt": "2026-05-25T08:15:00.000Z"
  }
}
```

客户端随后调用 API-09 `POST /prime/v1/general/emailOTP`，传 `scene = "ManualOAuthBind"` 和 `otpPurposeToken = oauthBindVerification.oauthBindVerificationHandle` 发送 OTP。

## API-03 / Example 04. 提交 legacy Email OTP 后，绑定成功

Request Header:

```http
X-Onekey-Request-Token: onekey-access-token
```

Request Body:

```json
{
  "token": "supabase-oauth-access-token",
  "confirmation": {
    "oauthBindVerificationHandle": "signed-oauth-bind-verification-handle",
    "otpUuid": "otp_uuid_123",
    "otpCode": "123456"
  }
}
```

Response:

```json
{
  "status": "success",
  "oauthIdentity": {
    "oauthIdentityId": "hash_google_2099999999",
    "provider": "google",
    "providerSubject": "209999999900000000000",
    "providerEmailType": "real",
    "providerVerifiedEmail": "neo.work@gmail.com",
    "normalizedEmail": "neo.work@gmail.com",
    "displayEmail": "n***@gmail.com"
  },
  "onekeyAccount": {
    "onekeyUserId": "onekey_legacy_A",
    "status": "active",
    "displayEmail": "n***@gmail.com",
    "identities": [
      {
        "identityType": "legacy_email",
        "normalizedEmail": "neo@gmail.com",
        "displayEmail": "n***@gmail.com"
      },
      {
        "identityType": "oauth",
        "oauthIdentityId": "hash_google_2099999999",
        "provider": "google",
        "providerSubject": "209999999900000000000",
        "providerEmailType": "real",
        "providerVerifiedEmail": "neo.work@gmail.com",
        "normalizedEmail": "neo.work@gmail.com",
        "displayEmail": "n***@gmail.com"
      }
    ]
  },
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "legacy_email_otp_confirmed"
  },
  "oauthBindVerification": null
}
```

## API-03 / Example 05. OAuth identity 已绑定到另一个 OneKeyID，返回错误

Request Header:

```http
X-Onekey-Request-Token: onekey-access-token
```

Request Body:

```json
{
  "token": "supabase-oauth-access-token"
}
```

Response:

```json
{
  "code": "oauth_identity_bound_to_another_account",
  "message": "OAuth identity is already bound to another OneKeyID.",
  "data": {
    "oauthIdentityId": "hash_google_1082048571",
    "provider": "google"
  }
}
```

客户端处理：不能把该 OAuth identity 通过 API-03 强行绑定或转移到当前 OneKeyID。如果用户要把这个 OAuth identity 从 OneKeyID A 转移到 legacy email OneKeyID B，必须走 API-04 / API-05 / API-06 的显式账号合并流程，最终由 API-06 `/merge/confirm` 改写 binding；也可以提示用户切换账号或联系支持。
