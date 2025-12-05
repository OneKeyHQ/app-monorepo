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

- 登录界面调用 supabase
- 移出 privy provider
- SupabaseAuthContext 改成 jotai global 存储
- supabase hooks 需要实现 isReady，断网情况下，isReady 确保工作
- 发送验证码需限频报错，目前是提示成功并进入验证码倒计时
  - 发送验证码接口 loading，按钮需要 loading 效果
- 验证码输入错误，目前直接成功登录，需要提示错误
- 封装 api 自动 throw error
- useOneKeyID

# Privy 接口下线

- 服务器 login、返佣、云端同步、prime 接口报错，确保客户端能提示 Error Toast，提示用户升级
- 服务器返回 Error，能触发客户端升级提醒


# 获取 Privy 用户列表

```js
// 导入 Privy Admin SDK
const { PrivyClient } = require('privy-node');

// 1. 从环境变量中安全地加载您的凭据
const APP_ID = process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error('错误：PRIVY_APP_ID 或 PRIVY_APP_SECRET 环境变量未设置。');
  process.exit(1); // 退出或进行错误处理
}

// 2. 初始化 Privy 客户端
const privyClient = new PrivyClient(APP_ID, APP_SECRET);

/**
 * 获取所有 Privy 用户的函数
 * 使用游标分页处理
 */
async function fetchAllPrivyUsers() {
  console.log('开始从 Privy 获取所有用户...');
  
  let allUsers = [];
  let cursor = undefined; // 初始游标为 undefined
  const limit = 100; // 每次请求获取的用户数量（最大值通常是 100 或 1000，请查阅文档）

  try {
    do {
      // 3. 调用 getUsers 方法，传入 limit 和 cursor
      const response = await privyClient.getUsers({
        limit: limit,
        cursor: cursor,
      });

      // 4. 将当前批次的用户添加到总列表中
      allUsers = allUsers.concat(response.users);
      
      // 5. 更新游标，为下一次循环做准备
      cursor = response.nextCursor;
      
      console.log(`已获取 ${response.users.length} 个用户... (总计: ${allUsers.length})`);

    } while (cursor); // 6. 如果 'nextCursor' 存在，则继续循环

    console.log(`--- 获取完成！总共获取到 ${allUsers.length} 个用户。---`);
    return allUsers;

  } catch (error) {
    console.error('获取 Privy 用户时出错:', error);
    return null;
  }
}

// --- 执行函数 ---
(async () => {
  const users = await fetchAllPrivyUsers();
  
  if (users) {
    // 7. 处理获取到的用户数据
    // 例如，打印第一个用户的信息
    if (users.length > 0) {
      console.log('\n第一个用户的信息示例:');
      console.log(users[0]);
    }
  }
})();
```

# 批量创建 Supabase 用户

```
您可以使用 supabase.auth.admin.createUser() 方法，在创建用户时不提供 password 字段，并且将 email_confirm 设置为 true。

省略 password：确保该用户没有密码，无法使用密码登录。

设置 email_confirm: true：(关键步骤) 这会立即将用户的电子邮件标记为“已验证”。这使得该邮箱可以立即接收 OTP 登录邮件，而无需先进行“邮箱验证”步骤。
```

```js
import { createClient } from '@supabase/supabase-js';

// **重要：请使用环境变量或安全配置来存储密钥**
const SUPABASE_URL = process.env.SUPABASE_URL; 
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 

// 初始化具有 Service Role 权限的 Supabase 客户端
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// 您需要批量导入的电子邮件列表
const emailsToCreate: string[] = [
  'user1@example.com',
  'user2@example.com',
  'user3@example.com',
  // ... 更多邮箱
];

/**
 * 批量创建仅限 OTP 登录的用户
 * @param emails 电子邮件地址列表
 */
async function bulkCreatePasswordlessUsers(emails: string[]) {
  console.log(`--- 开始批量创建 ${emails.length} 个无密码用户 ---`);
  
  const results = [];
  
  for (const email of emails) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        // **关键：**
        // 1. 不提供 'password' 字段
        // 2. 将 'email_confirm' 设为 true，使其立即生效
        email_confirm: true, 
        user_metadata: {
          // 您可以在这里添加任何需要的初始元数据
          imported_by: 'admin_script_v1'
        }
      });

      if (error) {
        console.error(`❌ 创建用户 ${email} 失败:`, error.message);
        results.push({ email: email, success: false, error: error.message });
      } else {
        console.log(`✅ 成功创建无密码用户: ${data.user.id} (${email})`);
        results.push({ email: email, success: true, id: data.user.id });
      }
    } catch (e) {
      console.error(`⚠️ 批量创建过程中发生异常: ${e.message}`);
      results.push({ email: email, success: false, error: e.message });
    }
  }

  console.log('--- 批量创建完成 ---');
  return results;
}

// 执行函数
// bulkCreatePasswordlessUsers(emailsToCreate);
```


# 服务器数据迁移

privyUserId -> onekeyUserId 



# RevenueCat 数据迁移

## 客户端动态迁移，同时保证新旧版本客户端获取订阅状态

```
await Purchases.configure({ ..., appUserID: privyUserId });
await Purchases.logIn(onekeyUserId);
```

## 服务端 RevenueCat 查询逻辑，需同时支持 privyUserId （旧版客户端）和 onekeyUserId（新版客户端）





