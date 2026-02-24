# 云端同步服务器身份认证指南

## 概述

云端同步服务器支持两种身份认证方式：OneKey ID 认证和 Keyless 签名认证。服务器根据请求中的 HTTP Header 来判断使用哪种认证方式，并验证用户的合法性。

## 认证方式优先级

服务器在处理请求时，按照以下优先级判断认证方式：

1. **优先检查 Keyless 签名**：如果请求中包含 `x-keyless-sync-signature` header，使用 Keyless 签名认证
2. **回退到 OneKey ID**：如果没有 Keyless 签名 header，则使用 `X-Onekey-Request-Token` header 进行 OneKey ID 认证

## 方式一：OneKey ID 认证（已经实现）

### Header 格式

```
X-Onekey-Request-Token: <auth_token>
```

### 用户标识提取

1. 从 `X-Onekey-Request-Token` header 中获取认证 token
2. 验证 token 的有效性（调用 Supabase 服务验证 token 签名和用户信息）
3. 从 token 中提取 `supabaseUserId` 作为用户唯一标识

### Token 验证流程

1. 检查 token 是否存在且格式正确
2. 验证 token 签名
3. 检查 token 是否过期
4. 提取用户信息（supabaseUserId）
5. **验证用户是否为 Prime 会员**（必须为付费会员才能使用云端同步）

### 客户端实现示例

参考代码：`packages/kit-bg/src/services/ServiceBase.ts:56-69`

```typescript
const client = await appApiClient.getClient(await getEndpointInfo({ name }));
client.interceptors.request.use(async (config) => {
  const authToken = await this.backgroundApi.simpleDb.prime.getAuthToken();
  if (authToken) {
    // 添加 OneKey ID 认证 token
    config.headers['X-Onekey-Request-Token'] = authToken;
  }
  return config;
});
```

## 方式二：Keyless 签名认证

### Header 格式

```
x-keyless-sync-signature: <base64_encoded_signature_payload>
```

### Signature Payload 结构

`x-keylessless-sync-signature` header 的值是 Base64 编码的 JSON，包含以下字段：

```typescript
{
  publicKey: string;      // 签名公钥（hex 格式）
  signature: string;      // ECDSA 签名（hex 格））
  timestamp: number;      // Unix 时间戳（毫秒）
  nonce: string;          // 随机数，用于防重放攻击
}
```

### 用户标识提取

1. 解析 `x-keyless-sync-signature` header，获取 signature payload
2. 验证签名的有效性（见下方签名验证流程）
3. 从 signature payload 中提取 `publicKey` 作为用户唯一标识

**重要提示**：向数据库写入用户数据时，建议使用 `Keyless:` 前缀加 publicKey 作为最终的 userId，以防止与 OneKey ID 方式的 userId（supabaseUserId）发生碰撞。

```typescript
// 示例：构建唯一的数据库 userId
const buildUserId = (publicKey: string): string => {
  return `Keyless:${publicKey}`;
};

// 使用示例
const userId = buildUserId(signaturePayload.publicKey);
// userId 格式：Keyless:0x1234567890abcdef...
```

### Keyless 认证的优势

**重要说明**：当使用 Keyless 签名认证时，与 OneKey ID 认证相比有以下区别：

1. **无需 OneKey ID 登录**：不需要用户登录 OneKey ID 账号
2. **无需 Prime 会员验证**：不需要验证用户是否为付费 Prime 会员
3. **基于公钥身份**：用户身份由签名公钥（publicKey）唯一标识

**原因**：
- Keyless 模式是去中心化的身份认证方式，基于用户设备的签名私钥
- 用户不需要注册 OneKey ID 账号即可使用云端同步功能
- 不依赖订阅制，任何拥有 Keyless 钱包的用户都可以使用云端同步

### 签名验证流程

#### 1. 解析 Signature Header

```typescript
const parseSignatureHeader = (
  signatureHeader: string,
): {
  publicKey: string;
  signature: string;
  timestamp: number;
  nonce: string;
} | null => {
  try {
    const decoded = Buffer.from(signatureHeader, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};
```

#### 2. 验证时间戳和 Nonce（防重放攻击）

**时间戳验证规则**：
- 时间戳与服务器时间差不能超过 5 分钟（`TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000`）
- 时间戳不能来自未来（允许 1 分钟的时钟偏差）

**Nonce 验证规则**：
- Nonce 必须是唯一的，已被使用的 nonce 会被拒绝
- 在 `TIMESTAMP_TOLERANCE_MS` 时间窗口内维护已使用的 nonce 列表
- **定期清理已过期的 nonce**：防止内存暴涨，建议每处理 100 个请求或每隔 5 分钟清理一次

```typescript
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 分钟
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 1 分钟时钟偏差
const usedNonces = new Map<string, number>(); // nonce -> timestamp

/**
 * 清理过期的 nonce（防止内存暴涨）
 */
const cleanupExpiredNonces = (): void => {
  const now = Date.now();
  const expiredNonces: string[] = [];

  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > TIMESTAMP_TOLERANCE_MS) {
      expiredNonces.push(nonce);
    }
  }

  for (const nonce of expiredNonces) {
    usedNonces.delete(nonce);
  }

  if (expiredNonces.length > 0) {
    console.log(`[Auth] Cleaned up ${expiredNonces.length} expired nonces`);
  }
};

const verifyTimestampAndNonce = (
  timestamp: number,
  nonce: string,
): { valid: boolean; error?: string } => {
  const now = Date.now();

  // 检查时间戳是否在允许范围内
  const timeDiff = Math.abs(now - timestamp);
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    return {
      valid: false,
      error: `Timestamp out of range: ${timeDiff}ms`,
    };
  }

  // 检查时间戳是否来自未来
  if (timestamp > now + CLOCK_SKEW_TOLERANCE_MS) {
    return {
      valid: false,
      error: `Timestamp is from the future`,
    };
  }

  // 检查 nonce 是否已被使用
  if (usedNonces.has(nonce)) {
    return {
      valid: false,
      error: `Nonce has already been used: ${nonce}`,
    };
  }

  // 记录此 nonce 为已使用
  usedNonces.set(nonce, timestamp);

  // 定期清理过期的 nonce（每 100 次验证清理一次）
  if (usedNonces.size % 100 === 0) {
    cleanupExpiredNonces();
  }

  return { valid: true };
};
```

#### 3. 计算请求 Body 的 Hash

**重要**：必须使用确定性序列化（stable-stringify）计算数据哈希，确保客户端和服务器产生相同的 hash。

**获取请求 Body（Express 框架示例）**：

```typescript
import express, { Request, Response } from 'express';
const app = express();

// 使用 express.json() 中间件解析 JSON body
app.use(express.json());

app.post('/prime/v1/sync/upload', async (req: Request, res: Response) => {
  // 从 Express Request 对象中获取 body
  const requestBody = req.body;

  // 计算数据 hash
  const postDataString = stableStringify(requestBody);
  const dataHash = computeDataHash(postDataString);

  // ... 后续验证逻辑
});
```

**Node.js HTTP 原生模块示例**：

```typescript
import http from 'http';

const readJsonBody = async (req: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const bodyText = Buffer.concat(chunks).toString('utf8');
  if (!bodyText) {
    return {};
  }
  return JSON.parse(bodyText) as unknown;
};

const server = http.createServer(async (req, res) => {
  // 从原生 HTTP 请求中读取 body
  const requestBody = await readJsonBody(req);

  // 计算数据 hash
  const postDataString = stableStringify(requestBody);
  const dataHash = computeDataHash(postDataString);

  // ... 后续验证逻辑
});
```

**Hash 计算实现**：

```typescript
import safeStringify from 'fast-safe-stringify';
import crypto from 'crypto';

const stableStringify = (obj: unknown): string => {
  return safeStringify.stableStringify(obj);
};

const computeDataHash = (data: string): string => {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};

// 使用示例（从请求中获取 body 后）
const postDataString = stableStringify(requestBody);
const dataHash = computeDataHash(postDataString);
```

#### 4. 重构签名消息并验证签名

签名消息的结构：

```typescript
const signMessage = {
  timestamp,
  nonce,
  dataHash,
};
```

**签名验证步骤**：

1. 使用 `stableStringify` 对 `signMessage` 进行序列化
2. 计算 SHA256 hash
3. 使用 secp256k1 验证 ECDSA 签名
4. 签名格式：客户端发送 65 字节（r + s + recoveryParam），验证时需要 64 字节（r + s）

```typescript
import * as secp256k1 from '@noble/secp256k1';

const verifySignature = async ({
  publicKey,
  signature,
  timestamp,
  nonce,
  dataHash,
}: {
  publicKey: string;
  signature: string;
  timestamp: number;
  nonce: string;
  dataHash: string;
}): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Step 1: 验证时间戳和 nonce
    const replayCheck = verifyTimestampAndNonce(timestamp, nonce);
    if (!replayCheck.valid) {
      return { valid: false, error: replayCheck.error };
    }

    // Step 2: 重构签名消息
    const signMessage = {
      timestamp,
      nonce,
      dataHash,
    };
    const messageString = stableStringify(signMessage);

    // Step 3: 计算 SHA256 hash
    const messageHash = crypto
      .createHash('sha256')
      .update(messageString, 'utf8')
      .digest();

    // Step 4: 转换签名格式（65 字节 -> 64 字节）
    const signature64Bytes =
      signature.length === 130 ? signature.slice(0, 128) : signature;

    // Step 5: 验证签名
    const isValid = secp256k1.verify(
      signature64Bytes,
      messageHash.toString('hex'),
      publicKey,
      { strict: false }, // 允许非严格 DER 签名
    );

    return { valid: isValid };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
};
```

### 客户端签名生成示例

参考代码：`packages/kit-bg/src/services/ServicePrimeCloudSync/ServicePrimeCloudSync.tsx:186-219`

```typescript
async getKeylessSyncAuth({
  postData,
}: {
  postData:
    | ICloudSyncCheckServerStatusPostData
    | ICloudSyncDownloadPostData
    | ICloudSyncUploadPostData;
}): Promise<{ publicKey: string; signatureHeader: string } | null> {
  // 1. 获取用户密码
  const password = await this.backgroundApi.servicePassword.getCachedPassword();
  if (!password) {
    return null;
  }

  // 2. 获取 Keyless 签名凭证
  const syncCredential = await this.getSyncCredentialSafe();
  const keylessCredential = syncCredential?.keylessCredential;
  if (!keylessCredential) {
    return null;
  }

  // 3. 构建签名 header
  const signatureHeader = await keylessCloudlessUtils.buildKeylessSignatureHeader({
    signingPrivateKey: keylessCredential.signingPrivateKey,
    signingPublicKey: keylessCredential.signingPublicKey,
    password,
    dataHash: keylessCloudSyncUtils.computeDataHash(
      stringUtils.stableStringify(postData),
    ),
  });

  return {
    publicKey: keylessCredential.signingPublicKey,
    signatureHeader,
  };
}
```

### 服务器验证示例

参考代码：`packages/kit-bg/src/services/ServicePrimeCloudSync/keylessCloudSyncMockServer/index.ts:287-338`

```typescript
if (url === '/prime/v1/sync/upload') {
  const body = (await readJsonBody(req)) as ICloudSyncUploadPostData;

  // 1. 检查签名 header 是否存在
  if (!signatureHeader) {
    sendJson(res, 401, {
      code: 401,
      message: 'Missing x-keyless-sync-signature header',
      data: null,
    });
    return;
  }

  // 2. 解析签名 header
  const signaturePayload = parseSignatureHeader(signatureHeader);
  if (!signaturePayload) {
    sendJson(res, 401, {
      code: 401,
      message: 'Invalid signature header format',
      data: null,
    });
    return;
  }

  // 3. 计算请求 body 的 hash
  const postDataString = stableStringify(body);
  const dataHash = computeDataHash(postDataString);

  // 4. 验证签名
  const verifyResult = await verifySignature({
    publicKey: signaturePayload.publicKey,
    signature: signaturePayload.signature,
    timestamp: signaturePayload.timestamp,
    nonce: signaturePayload.nonce,
    dataHash,
  });

  if (!verifyResult.valid) {
    sendJson(res, 401, {
      code: 401,
      message: verifyResult.error || 'Invalid signature',
      data: null,
    });
    return;
  }

  // 5. 使用 publicKey 作为用户 ID 处理请求
  const result = await store.upload({
    publicKey: signaturePayload.publicKey,
    postData: body,
  });
  sendJson(res, 200, { code: 0, message: 'ok', data: result });
  return;
}
```

## Keyless 认证的特殊限制

### 不支持 Lock 数据同步

**重要**：使用 Keyless 签名认证时，不支持 lock 数据的云端同步。

**原因**：
- Lock 数据是 OneKey ID 方式的主密码存储区域，用于在云端加密存储用户的主密码
- Keyless 模式不涉及主密码（通过签名私钥直接验证），因此不需要 lock 数据的云端同步

**实现建议**：

1. 在服务器处理客户端的 upload/download 请求时，检查是否为 Keyless 认证
2. 如果是 Keyless 认证，过滤掉类型为 `EPrimeCloudSyncDataType.Lock` 的数据项
3. 在响应中明确标识不支持 lock 数据同步

```typescript
// 示例：过滤 lock 数据
const filteredItems = clientUploadItems.filter(
  (item) => item.dataType !== EPrimeCloudSyncDataType.Lock,
);
```

## 完整的服务器认证流程

```typescript
async function authenticateRequest(req: http.IncomingMessage) {
  const signatureHeader = getHeaderValue(req, 'x-keyless-sync-signature');
  const tokenHeader = getHeaderValue(req, 'X-Onekey-Request-Token');

  // 优先级 1：Keyless 签名认证
  if (signatureHeader) {
    const signaturePayload = parseSignatureHeader(signatureHeader);
    if (!signaturePayload) {
      throw new Error('Invalid signature header format');
    }

    // 计算请求 body hash
    const body = await readJsonBody(req);
    const dataHash = computeDataHash(stableStringify(body));

    // 验证签名
    const verifyResult = await verifySignature({
      publicKey: signaturePayload.publicKey,
      signature: signaturePayload.signature,
      timestamp: signaturePayload.timestamp,
      nonce: signaturePayload.nonce,
      dataHash,
    });

    if (!verifyResult.valid) {
      throw new Error(verifyResult.error || 'Invalid signature');
    }

    return {
      authType: 'keyless',
      userId: `Keyless:${signaturePayload.publicKey}`,
    };
  }

  // 优先级 2：OneKey ID 认证
  if (tokenHeader) {
    // 验证 token
    const userInfo = await verifyOneKeyIdToken(tokenHeader);
    if (!userInfo) {
      throw new Error('Invalid token');
    }

    // 验证用户是否为 Prime 会员
    const isPrimeMember = await checkPrimeMembership(userInfo.supabaseUserId);
    if (!isPrimeMember) {
      throw new Error('Prime membership required');
    }

    return {
      authType: 'onekey-id',
      userId: userInfo.supabaseUserId,
    };
  }

  throw new Error('No authentication method provided');
}

// 使用示例：处理客户端的 upload 请求
async function handleClientUpload(req: http.IncomingMessage) {
  try {
    const { authType, userId } = await authenticateRequest(req);

    const body = await readJsonBody(req);

    // Keyless 模式：过滤 lock 数据
    if (authType === 'keyless') {
      body.items = body.items.filter(
        (item) => item.dataType !== EPrimeCloudSyncDataType.Lock,
      );
    }

    // 服务器端：将数据写入本地数据库
    const result = await saveToDatabase(userId, body);
    return result;
  } catch (error) {
    return {
      code: 401,
      message: error.message,
      data: null,
    };
  }
}
```

## 安全注意事项

### OneKey ID 认证

1. **Token 安全**：
   - Token 必须通过 HTTPS 传输
   - 服务端必须验证 token 的完整性和有效期
   - Token 过期后需要客户端刷新

2. **Token 存储**：
   - 客户端安全存储 token（使用加密存储）
   - 避免在日志中记录 token

### Keyless 签名认证

1. **私钥保护**：
   - 签名私钥必须安全存储（使用加密存储）
   - 私钥永不离开客户端设备

2. **签名安全**：
   - 必须使用确定性序列化计算 dataHash
   - 必须包含 timestamp 和 nonce 防止重放攻击
   - 时间戳窗口应限制在合理范围内（建议 5 分钟）

3. **Nonce 管理**：
   - 服务端必须维护已使用的 nonce 列表
   - 定期清理过期的 nonce
   - Nonce 应该是足够长的随机字符串（建议 32 字节以上）

4. **公钥身份**：
   - 公钥作为用户唯一标识，服务端需要将其与用户数据关联存储
   - 首次使用时可能需要用户绑定公钥到账户

## 认证方式对比

| 特性 | OneKey ID 认证 | Keyless 签名认证 |
|------|---------------|------------------|
| **认证方式** | JWT Token | ECDSA 签名 |
| **用户标识** | supabaseUserId | Keyless:{publicKey} |
| **Header 名称** | `X-Onekey-Request-Token` | `x-keyless-sync-signature` |
| **需要登录 OneKey ID** | ✅ 是 | ❌ 否 |
| **需要 Prime 会员** | ✅ 是 | ❌ 否 |
| **支持 lock 数据同步** | ✅ 支持 | ❌ 不支持 |
| **身份验证方式** | 中心化（服务器验证） | 去中心化（密码学验证） |
| **跨设备同步** | 基于账号，支持任意设备 | 基于私钥，需导入私钥或使用相同设备 |
| **防重放攻击** | Token 过期机制 | Timestamp + Nonce 机制 |

## 接口兼容性说明

### 接口定义保持不变

两种认证方式使用相同的接口定义，通过 HTTP Header 区分认证方式：

- `/prime/v1/sync/upload` - 上传数据
- `/prime/v1/sync/download` - 下载数据
- `/prime/v1/sync/check-status` - 检查服务器状态

### Header 判断逻辑

```typescript
// 服务端判断逻辑
function determineAuthMethod(req: http.IncomingMessage) {
  const hasKeyless = !!getHeaderValue(req, 'x-keyless-sync-signature');
  const hasToken = !!getHeaderValue(req, 'X-Onekey-Request-Token');

  if (hasKeyless) {
    return 'keyless';
  }
  if (hasToken) {
    return 'onekey-id';
  }
  return 'none';
}
```

## 测试建议

### OneKey ID 认证测试

1. 使用有效 token 访问接口，应成功
2. 使用过期 token 访问接口，应返回 401
3. 使用无效 token 访问接口，应返回 401
4. 不提供 token 访问接口，应返回 401

### Keyless 签名认证测试

1. 使用有效签名访问接口，应成功
2. 修改请求 body 后使用相同签名访问，应返回 401
3. 重放相同请求（相同 nonce），应返回 401
4. 使用过期时间戳（超过 5 分钟），应返回 401
5. 使用未来时间戳，应返回 401
6. 不提供签名 header 访问接口，应返回 401

### 混合场景测试

1. 同时提供 token 和签名 header，应优先使用签名认证
2. Keyless 认证时上传 lock 数据，应被过滤

## 参考代码

### 客户端代码

- `ServiceBase.ts:56-69` - OneKey ID token 注入
- `ServicePrimeCloudSync.tsx:186-219` - Keyless 签名生成
- `ServicePrimeCloudSync.tsx:221-292` - Keyless API 调用

### 服务器代码

- `keylessCloudSyncMockServer/index.ts:282-338` - Keyless 签名验证
- `keylessCloudSyncMockServer/index.ts:98-229` - 签名解析和验证工具函数

## 总结

1. **两种认证方式**：OneKey ID（token）和 Keyless（签名）
2. **优先级**：Keyless 签名 > OneKey ID token
3. **安全要求**：必须验证 token 或签名的有效性
4. **认证差异**：
   - OneKey ID：需要登录账号，必须为 Prime 会员
   - Keyless：无需登录，无需 Prime 会员，基于公钥身份
5. **特殊限制**：Keyless 认证不支持 lock 数据同步
6. **接口兼容**：接口定义不变，通过 header 区分
7. **安全最佳实践**：HTTPS 传输、加密存储、防重放攻击
