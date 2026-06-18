# API-04 到 API-06 + API-09 Merge Examples

本文档是 [server-apis.md](./server-apis.md) 中 API-04 到 API-06 显式账号合并流程，以及 API-09 `MergeExistingOneKeyId` 发码场景的示例补充。主接口文档保留类型、枚举和规则；具体场景请求 / 响应示例集中放在这里。

API-04 到 API-06 只覆盖一条 source 路径：当前已经登录 OAuth OneKeyID，用户主动把这个 OAuth OneKeyID 合并到 target legacy email OneKeyID。API-06 成功后 source OneKeyID 标记为 `merged`，source active OAuth bindings retarget 到 target。

## Flow 01. 当前已登录 OAuth OneKeyID 合并到 legacy email target

该路径来自已登录 OAuth OneKeyID 的低曝光 `Merge existing OneKeyID` 入口。这里存在两个 OneKeyID：source 是当前 OAuth OneKeyID，target 是用户通过 legacy Email OTP 验证的 legacy email OneKeyID。

### Step 01. API-04 `POST /prime/v1/account/merge/prepare`

Request Body:

```json
{
  "sourceOneKeyIdAuthToken": "source-oauth-onekeyid-access-token",
  "targetLegacyEmail": "neo@gmail.com"
}
```

Response:

```json
{
  "otpScene": "MergeExistingOneKeyId",
  "otpPurposeToken": "otp-purpose-token-merged-source-001",
  "targetLegacyDisplayEmail": "n***@gmail.com",
  "expiresAt": "2026-06-01T08:30:00.000Z"
}
```

### Step 02. API-09 `POST /prime/v1/general/emailOTP`

Request Body:

```json
{
  "scene": "MergeExistingOneKeyId",
  "otpPurposeToken": "otp-purpose-token-merged-source-001"
}
```

Response:

```json
{
  "resendAt": 1780302630,
  "uuid": "otp-uuid-merged-source-001"
}
```

### Step 03. API-05 `POST /prime/v1/account/merge/verify-target`

Request Body:

```json
{
  "sourceOneKeyIdAuthToken": "source-oauth-onekeyid-access-token",
  "otpPurposeToken": "otp-purpose-token-merged-source-001",
  "otpUuid": "otp-uuid-merged-source-001",
  "otpCode": "123456"
}
```

Response:

```json
{
  "source": {
    "sourceOneKeyUserId": "onekey_oauth_A",
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
    }
  },
  "targetOneKeyAccount": {
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
      }
    ]
  },
  "mergeRequestId": "merge_req_merged_source_001",
  "mergeConfirmToken": "merge-confirm-token-merged-source-001",
  "expiresAt": "2026-06-01T08:35:00.000Z"
}
```

### Step 04. API-06 `POST /prime/v1/account/merge/confirm`

Request Body:

```json
{
  "mergeRequestId": "merge_req_merged_source_001",
  "mergeConfirmToken": "merge-confirm-token-merged-source-001",
  "sourceOneKeyIdAuthToken": "source-oauth-onekeyid-access-token",
  "token": "supabase-oauth-access-token-current-apple"
}
```

Response:

```json
{
  "status": "merged",
  "mergeExecution": {
    "mergeRequestId": "merge_req_merged_source_001",
    "sourceOneKeyUserId": "onekey_oauth_A",
    "targetOneKeyUserId": "onekey_legacy_A",
    "status": "merged",
    "mergedAt": "2026-06-01T08:31:30.000Z"
  },
  "onekeySession": {
    "accessToken": "target-onekey-access-token",
    "refreshToken": "target-onekey-refresh-token"
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
  "oauthIdentityBinding": {
    "bindingStatus": "bound",
    "boundOneKeyUserId": "onekey_legacy_A",
    "bindReason": "merged_source_retarget"
  }
}
```

## API-06 / Example 02. 同一个 `mergeRequestId` 重试命中处理中状态

如果第一次 API-06 已经创建 execution record，但主事务仍在处理中，客户端重试同一个 `mergeRequestId` 时，服务端在授权通过后返回当前状态，不重复执行。

Request Body:

```json
{
  "mergeRequestId": "merge_req_merged_source_001",
  "mergeConfirmToken": "merge-confirm-token-merged-source-001",
  "sourceOneKeyIdAuthToken": "source-oauth-onekeyid-access-token",
  "token": "supabase-oauth-access-token-current-apple"
}
```

Response:

```json
{
  "status": "processing",
  "mergeExecution": {
    "mergeRequestId": "merge_req_merged_source_001",
    "sourceOneKeyUserId": "onekey_oauth_A",
    "targetOneKeyUserId": "onekey_legacy_A",
    "status": "processing"
  },
  "retryAfterSeconds": 3
}
```
