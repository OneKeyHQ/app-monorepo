/**
 * 完整流程内容数据，来源：server-apis.md / api-01 / api-03 / api-04-05-06-09 examples。
 * 卡片式（form-cards.html）渲染。
 *
 * 节点 type：
 *   api      接口调用        蓝
 *   user     用户操作        紫
 *   success  成功 / 终态     绿
 *   error    错误 / 终止     红
 *   info     待合并 / 中间态  橙（manual_merge_required、processing 等需后续动作）
 *
 * 分叉两种写法：
 *   node.groups   —— 多路分支按结果分组（成功 / 转入合并 / 终止）。用于 API-01、API-03。
 *   node.branches —— 扁平分支；恰好 2 条且未标 forkStyle:'list' 时左右对称，否则纵向罗列。
 *   branch.nodes 是该分支下的子序列（可再带 branches，支持嵌套）。
 *   node.goto = 另一个 scenario.id 时，卡片内出现「转到 xx 流程」跳转按钮。
 */
window.FLOW_META = {
  colors: { pre: "#64748b", api: "#2563eb", user: "#7c3aed", success: "#16a34a", error: "#dc2626", info: "#d97706" },
  tags: { pre: "前置条件", api: "接口调用", user: "用户操作", success: "成功", error: "错误 / 终止", info: "待合并 / 中间态" },
};

window.FLOWS = [
  /* ============================ 场景 1：API-01 OAuth 登录 / Upsert ============================ */
  {
    id: "oauth-login",
    tab: "API-01 OAuth 登录",
    title: "API-01 · OAuth 登录 / Upsert",
    summary:
      "用户用 Google / Apple 登录。服务端在同一个 upsert 入口完成 OAuth identity 校验、登录 / 创建 OneKeyID、同 verified email 自动绑定，必要时返回 manual_merge_required 进入显式合并。",
    blocks: [
      {
        id: "pre-login", type: "pre", title: "前置：用户未登录，要建立 OneKeyID 登录态",
        subtitle: "新用户 / 新设备 / 已登出，用户点 Google 或 Apple 登录。本地可能残留一个旧 legacy OneKeyID 登录态（可作防分叉信号），也可能没有。",
        detail: { notes: ["有可验证 legacy 登录态时，客户端把它作为 legacyOneKeyIdAuthToken 一并提交。", "已登录 legacy email OneKeyID、想主动加 OAuth 登录方式的，走 API-03（见对应标签），不走这里。"] },
      },
      {
        id: "login-start",
        type: "api",
        title: "POST /account/oauth/login",
        subtitle:
          "客户端提交 OAuth Supabase access token；本地有可验证旧 OneKeyID 时附带 legacyOneKeyIdAuthToken（仅防分叉信号）。服务端判定归属，产出以下其一。",
        detail: {
          params: ["token（OAuth Supabase access token）", "legacyOneKeyIdAuthToken?（可选防分叉信号）"],
          returns: ["oauthIdentity（始终返回）", "status = success | manual_merge_required"],
          notes: [
            "API-01 不接收 legacy Email OTP。",
            "同 verified email 的自动绑定必须在这里完成，不进入 pending merge。",
            "legacyOneKeyIdAuthToken 即使验证通过，也只触发 manual_merge_required，绝不直接绑定。",
            "终止类错误（account_merged_reauth_required / support_required / oauth_credential_invalid）走 error code，不放在 status。",
          ],
        },
        groups: [
          {
            title: "自动完成 · 直接登录 / 创建",
            tone: "ok",
            branches: [
              { label: "① OAuth identity 已有 active binding", nodes: [{
                id: "ok-existing", type: "success", title: "正常登录已绑定账号（Ex01）",
                subtitle: "直接登录原 OneKeyID，返回 active session。",
                detail: { returns: ["status: success", "onekeySession", "onekeyAccount(active)", "bindReason = existing_oauth_binding"], notes: ["流程结束。"] },
              }] },
              { label: "② 未绑定 · verified email 命中 legacy OneKeyID", nodes: [{
                id: "ok-legacy", type: "success", title: "同 email 自动绑定 legacy（Ex02）",
                subtitle: "verified normalizedEmail 命中唯一 active legacy OneKeyID，自动绑定。",
                detail: { returns: ["status: success", "onekeyAccount 含 legacy_email + oauth", "bindReason = legacy_email_auto_bind"], notes: ["不要求 legacy Email OTP。"] },
              }] },
              { label: "③ 未绑定 · verified email 命中 active email claim owner", nodes: [{
                id: "ok-claim", type: "success", title: "email claim 自动绑定（Ex03）",
                subtitle: "无 legacy 命中时，命中唯一 active email claim owner。",
                detail: { returns: ["status: success", "bindReason = email_claim_auto_bind"], notes: ["服务端通过 email claim 归属，不是客户端比较两个 OAuth 账号。"] },
              }] },
              { label: "④ 未命中任何 legacy / email claim", nodes: [{
                id: "ok-new", type: "success", title: "创建新的 OAuth OneKeyID（Ex04）",
                subtitle: "无 binding、无同 email 目标、无合法 legacy token。",
                detail: { returns: ["status: success", "新 onekeyUserId", "bindReason = new_oauth_account_created"] },
              }] },
              { label: "⑤ 无 verified email（如 Apple 未返回）且无合法 legacy token", nodes: [{
                id: "ok-oauthonly", type: "success", title: "创建 OAuth-only OneKeyID（Ex05）",
                subtitle: "oauthEmailType = missing_or_unverified。",
                detail: { returns: ["status: success", "bindReason = new_oauth_account_created"], notes: ["不创建 email claim，不参与同 email 自动绑定。"] },
              }] },
            ],
          },
          {
            title: "转入显式合并（manual_merge_required）",
            tone: "warn",
            branches: [
              { label: "⑥ email mismatch + 有合法 legacy token", nodes: [{
                id: "mm-mismatch", type: "info", title: "manual_merge_required（Ex06）",
                subtitle: "OAuth verified email 与本地 legacy 账号不一致，不能静默绑定。",
                goto: "merge-pending",
                detail: { returns: ["status: manual_merge_required", "sourceType = pending_oauth_bind", "reason = oauth_email_mismatch", "pendingOAuthBindToken, expiresAt"], notes: ["2xx workflow status，非错误。后续走 /merge/prepare。"] },
              }] },
              { label: "⑦ Apple private relay + 有合法 legacy token", nodes: [{
                id: "mm-relay", type: "info", title: "manual_merge_required（Ex07）",
                subtitle: "private relay email 不能自动合并到真实 legacy email。",
                goto: "merge-pending",
                detail: { returns: ["reason = apple_private_relay", "pendingOAuthBindToken"], notes: ["无合法 legacy token 时改为创建独立 OAuth OneKeyID。"] },
              }] },
              { label: "⑧ 无 verified email + 有合法 legacy token", nodes: [{
                id: "mm-missing", type: "info", title: "manual_merge_required（Ex08）",
                subtitle: "OAuth credential 无 verified email，不能参与同 email 自动绑定。",
                goto: "merge-pending",
                detail: { returns: ["reason = missing_or_unverified_email", "pendingOAuthBindToken"], notes: ["无合法 legacy token 时改为创建 OAuth-only OneKeyID。"] },
              }] },
            ],
          },
          {
            title: "终止 / 错误（error code）",
            tone: "no",
            branches: [
              { label: "⑨ OAuth binding 指向 merged source", nodes: [{
                id: "err-merged", type: "error", title: "account_merged_reauth_required（Ex09）",
                subtitle: "binding retarget 不完整，拒绝签发 source 普通 session。",
                detail: { returns: ["code: account_merged_reauth_required"], notes: ["客户端清理本地 session / primePersistAtom，回登录页让用户手动重登；不能自动重试。"] },
              }] },
              { label: "⑩ 合并 / 绑定数据异常", nodes: [{
                id: "err-support", type: "error", title: "support_required（Ex10）",
                subtitle: "无法自动处理的数据异常（如同 email 命中多个 active OneKeyID）。",
                detail: { returns: ["code: support_required", "data.reason 如 duplicate_legacy_email"], notes: ["不写 session、不建账号、不进登录态；展示客服入口。"] },
              }] },
            ],
          },
        ],
      },
    ],
  },

  /* ============================ 场景 2：API-03 Legacy 升级到 OAuth ============================ */
  {
    id: "legacy-upgrade",
    tab: "API-03 Legacy 升级",
    title: "API-03 · Legacy OneKeyID 升级到 OAuth 登录",
    summary:
      "当前已登录 legacy email OneKeyID 的用户，在 Account Security / Login methods 主动点 Upgrade with Google / Apple，把 OAuth identity 绑定到该 legacy email OneKeyID。没有第二个账号参与，不做 merge。",
    blocks: [
      {
        id: "pre-upgrade", type: "pre", title: "前置：已登录 legacy email OneKeyID",
        subtitle: "用户当前持有 legacy email OneKeyID 的有效 session（升级前遗留或兼容期保留），在 Account Security / Login methods 主动点 Upgrade with Google / Apple。",
        detail: { notes: ["没有 legacy session 的用户不能走 API-03：应先 API-01 登录，再走合并流程。"] },
      },
      {
        id: "bind-start",
        type: "api",
        title: "POST /account/identities/oauth/bind",
        subtitle:
          "同时提交 OAuth token + legacyOneKeyIdAuthToken（必填 target proof）。两份 proof 都验证通过才绑定，不需要 legacy Email OTP。",
        detail: {
          params: ["token（OAuth）", "legacyOneKeyIdAuthToken（必填 target proof）"],
          returns: ["status: success", "oauthIdentity", "onekeyAccount", "oauthIdentityBinding"],
          notes: [
            "target legacy OneKeyID 必须来自 body 的 legacyOneKeyIdAuthToken，不能从 X-Onekey-Request-Token 推断。",
            "没有 legacy session 的用户不能走 API-03：改走 API-01 登录 + API-04~06 合并。",
            "不是 API-01 manual_merge_required 的后续接口。",
          ],
        },
        groups: [
          {
            title: "绑定成功",
            tone: "ok",
            branches: [
              { label: "① OAuth identity 已绑定到该 legacy OneKeyID", nodes: [{
                id: "u-existing", type: "success", title: "幂等返回成功（Ex01）",
                subtitle: "已存在 active binding，直接返回。",
                detail: { returns: ["bindReason = existing_oauth_binding"] },
              }] },
              { label: "② legacy email == OAuth verified email", nodes: [{
                id: "u-same", type: "success", title: "静默绑定成功（Ex02）",
                subtitle: "同 email，直接绑定。",
                detail: { returns: ["bindReason = legacy_email_auto_bind"] },
              }] },
              { label: "③ OAuth email ≠ legacy email", nodes: [{
                id: "u-cross", type: "success", title: "双 token 授权绑定（Ex03）",
                subtitle: "OAuth token + legacy token 同时验证通过，跨 email 绑定。",
                detail: { returns: ["bindReason = legacy_session_authorized_bind"] },
              }] },
              { label: "④ Apple private relay identity", nodes: [{
                id: "u-relay", type: "success", title: "双 token 授权绑定（Ex04）",
                subtitle: "private relay 也可通过双 token 授权绑定。",
                detail: { returns: ["bindReason = legacy_session_authorized_bind"] },
              }] },
            ],
          },
          {
            title: "须转显式合并",
            tone: "warn",
            branches: [
              { label: "⑤ OAuth identity 已绑定到另一个 OneKeyID", nodes: [{
                id: "u-bound-other", type: "error", title: "oauth_identity_bound_to_another_account（Ex05）",
                subtitle: "不能强行转移到 legacy OneKeyID。",
                goto: "merge-source",
                detail: { returns: ["code: oauth_identity_bound_to_another_account"], notes: ["要转移须走 API-04 / 05 / 06，最终由 API-06 改写 binding。"] },
              }] },
              { label: "⑥ verified email 的 claim owner 是别的账号", nodes: [{
                id: "u-claim-conflict", type: "error", title: "oauth_email_claim_conflict",
                subtitle: "服务端不能覆盖该 email claim。",
                goto: "merge-source",
                detail: { notes: ["客户端进入显式账号合并或客服流程。"] },
              }] },
            ],
          },
          {
            title: "终止 / 错误",
            tone: "no",
            branches: [
              { label: "⑦ target 不是 legacy email OneKeyID", nodes: [{
                id: "u-need-legacy", type: "error", title: "oauth_bind_requires_legacy_email",
                subtitle: "target 没有 legacy_email identity（如 OAuth-only OneKeyID）。",
                detail: { notes: ["API-03 只服务 legacy email OneKeyID 升级。", "另有 onekey_session_invalid / account_merged_reauth_required / support_required 等终止错误。"] },
              }] },
            ],
          },
        ],
      },
    ],
  },

  /* ============================ 场景 3：合并流程 · pending_oauth_bind ============================ */
  {
    id: "merge-pending",
    tab: "合并 · pending",
    title: "显式合并 · pending_oauth_bind（来自 manual_merge_required）",
    summary:
      "API-01 返回 manual_merge_required 后继续。还没有 source OneKeyID；target 来自 pendingOAuthBindToken 已签入的 legacy 上下文，用户不再输入 target email。完成 legacy Email OTP 后，API-06 把当前 OAuth identity 绑定到 target legacy OneKeyID。",
    blocks: [
      {
        id: "pre-pending", type: "pre", title: "前置：API-01 返回 manual_merge_required",
        subtitle: "用户刚用 Google / Apple 登录（API-01）并提交了可验证 legacyOneKeyIdAuthToken，但 OAuth email 无法自动归属，服务端返回 pendingOAuthBindToken，客户端进入 pending merge state。",
        goto: "oauth-login",
        detail: { notes: ["reason ∈ oauth_email_mismatch / apple_private_relay / missing_or_unverified_email。", "还没有 source OneKeyID；target legacy OneKeyID 已签入 pendingOAuthBindToken。"] },
      },
      {
        id: "p-prepare", type: "api", title: "API-04 POST /merge/prepare",
        subtitle: "预检查并签发 OTP purpose；不发 OTP、不创建 merge request。",
        detail: {
          params: ["pendingOAuthBindToken（来自 API-01）"],
          returns: ["otpScene = MergeExistingOneKeyId", "otpPurposeToken", "targetLegacyDisplayEmail", "expiresAt"],
          notes: ["target 从 token 解析，本路径不能提交 targetLegacyEmail。", "不持久化 pending merge 状态。", "OTP 完成前不暴露 target 是否存在（防枚举）。"],
        },
      },
      {
        id: "p-otp", type: "api", title: "API-09 POST /general/emailOTP",
        subtitle: "发送 target legacy Email OTP。",
        detail: { params: ["scene = MergeExistingOneKeyId", "otpPurposeToken"], returns: ["resendAt", "uuid"] },
      },
      {
        id: "p-verify", type: "api", title: "API-05 POST /merge/verify-target",
        subtitle: "用户输入 OTP，验证 target 并生成短期 confirm proof；仍不执行绑定。",
        decision: "OTP 是否通过？",
        detail: {
          params: ["pendingOAuthBindToken", "otpPurposeToken", "otpUuid", "otpCode"],
          returns: ["source（摘要）", "targetOneKeyAccount", "mergeRequestId", "mergeConfirmToken", "expiresAt"],
          notes: ["重新校验 source proof。", "确认 pendingOAuthBindToken 与 otpPurposeToken 指向同一 target。"],
        },
        branches: [
          {
            label: "OTP 通过",
            tone: "ok",
            nodes: [
              {
                id: "p-confirm-page", type: "user", title: "确认页：用户二次确认",
                subtitle: "展示将把哪个 OAuth identity 绑定到哪个 legacy OneKeyID。明确：没有 source OneKeyID、不迁移 source 数据。",
                detail: { notes: ["客户端不能在 OTP 成功后自动执行，必须等用户点确认。"] },
              },
              {
                id: "p-confirm", type: "api", title: "API-06 POST /merge/confirm",
                subtitle: "最终绑定执行（唯一写入点）。重新校验 mergeConfirmToken + source proof + 当前 OAuth token，按 mergeRequestId 幂等。",
                decision: "执行结果 status？",
                detail: {
                  params: ["mergeRequestId", "mergeConfirmToken", "pendingOAuthBindToken", "token（当前 OAuth）"],
                  notes: ["confirm 时切换了 OAuth credential → oauth_credential_mismatch，须重走 API-05。", "有 verified email 时在同事务为该 email 创建 / 迁移 active email claim 到 target。"],
                },
                forkStyle: "list",
                branches: [
                  { label: "merged", tone: "ok", nodes: [{
                    id: "p-done", type: "success", title: "完成：绑定到 target legacy OneKeyID",
                    subtitle: "返回 target session，客户端刷新 primePersistAtom。",
                    detail: { returns: ["status: merged", "onekeySession", "onekeyAccount（含 legacy_email + oauth）", "bindReason = manual_merge_confirmed_bind"], notes: ["不创建 source OneKeyID。流程结束。"] },
                  }] },
                  { label: "processing", tone: "warn", nodes: [{
                    id: "p-processing", type: "info", title: "处理中（Ex03 重试）",
                    subtitle: "同 mergeRequestId 已在执行中。",
                    detail: { returns: ["status: processing", "retryAfterSeconds"], notes: ["短时间后用同 mergeRequestId 重试，不重复执行。"] },
                  }] },
                  { label: "failed", tone: "no", nodes: [{
                    id: "p-failed", type: "error", title: "failed",
                    subtitle: "执行失败且已落库失败记录。",
                    detail: { notes: ["客户端不要自动重试。"] },
                  }] },
                  { label: "support_required", tone: "no", nodes: [{
                    id: "p-support", type: "error", title: "support_required",
                    subtitle: "无法自动判定，需客服 / 风控介入。",
                    detail: { notes: ["展示客服入口。"] },
                  }] },
                ],
              },
            ],
          },
          {
            label: "OTP 错误 / 过期",
            tone: "no",
            nodes: [{
              id: "p-otp-error", type: "error", title: "merge_otp_invalid / merge_otp_expired",
              subtitle: "OTP 不匹配或已过期。",
              detail: { notes: ["可重发 OTP 或重新走 API-05。", "另有 merge_source_invalid / merge_target_invalid / source_merge_in_progress。"] },
            }],
          },
        ],
      },
    ],
  },

  /* ============================ 场景 4：合并流程 · merged_source ============================ */
  {
    id: "merge-source",
    tab: "合并 · source",
    title: "显式合并 · merged_source（已登录 OAuth 主动合并）",
    summary:
      "用户已登录 OAuth OneKeyID，从低曝光入口 Merge existing OneKeyID 主动把它合并到 target legacy email OneKeyID。存在两个 OneKeyID：source（当前 OAuth）+ target（legacy email）。API-06 成功后 source 标记 merged，source active OAuth bindings retarget 到 target。",
    blocks: [
      {
        id: "pre-source", type: "pre", title: "前置：已登录 OAuth OneKeyID，想合并旧账号",
        subtitle: "用户已用 OAuth 登录并持有 active OAuth OneKeyID（可能是 API-01 新建的），从低曝光入口 Merge existing OneKeyID 主动发起，把它合并到某个 legacy email OneKeyID。",
        goto: "oauth-login",
        detail: { notes: ["存在两个 OneKeyID：source（当前 OAuth）+ target（legacy email）。", "source 须为 active OAuth OneKeyID，不能传 target legacy 的 token。"] },
      },
      {
        id: "s-input", type: "user", title: "入口：用户输入 target legacy email",
        subtitle: "在 Merge existing OneKeyID 入口输入要合并到的 legacy email。",
        detail: { notes: ["source 是当前已登录 OAuth OneKeyID session。"] },
      },
      {
        id: "s-prepare", type: "api", title: "API-04 POST /merge/prepare",
        subtitle: "校验 source 为 active OAuth OneKeyID，规范化 target email，签发 OTP purpose。",
        detail: {
          params: ["sourceOneKeyIdAuthToken（当前 OAuth OneKeyID token）", "targetLegacyEmail（用户输入，必填）"],
          returns: ["otpScene = MergeExistingOneKeyId", "otpPurposeToken", "targetLegacyDisplayEmail", "expiresAt"],
          notes: ["不能传 target legacy OneKeyID 的 token。", "OTP 验证前不返回 target 是否存在。"],
        },
      },
      {
        id: "s-otp", type: "api", title: "API-09 POST /general/emailOTP",
        subtitle: "发送 target legacy Email OTP。",
        detail: { params: ["scene = MergeExistingOneKeyId", "otpPurposeToken"], returns: ["resendAt", "uuid"] },
      },
      {
        id: "s-verify", type: "api", title: "API-05 POST /merge/verify-target",
        subtitle: "验证 OTP，返回 source / target 摘要，生成 confirm proof；不执行合并。",
        decision: "OTP 是否通过？",
        detail: {
          params: ["sourceOneKeyIdAuthToken", "targetLegacyEmail", "otpPurposeToken", "otpUuid", "otpCode"],
          returns: ["source.sourceType = merged_source + sourceOneKeyUserId", "targetOneKeyAccount", "mergeRequestId", "mergeConfirmToken"],
          notes: ["确认提交的 targetLegacyEmail 与 otpPurposeToken 中 target 一致。"],
        },
        branches: [
          {
            label: "OTP 通过",
            tone: "ok",
            nodes: [
              {
                id: "s-confirm-page", type: "user", title: "确认页：用户确认合并 source OneKeyID",
                subtitle: "展示 source OAuth OneKeyID 与 target legacy OneKeyID，明确 source 将被标记 merged。",
                detail: { notes: ["必须等用户确认才触发 API-06。"] },
              },
              {
                id: "s-confirm", type: "api", title: "API-06 POST /merge/confirm",
                subtitle: "最终合并执行。重新校验 token，确认其 identity 属于 source 且与 canonical source 一致。",
                decision: "执行结果 status？",
                detail: {
                  params: ["mergeRequestId", "mergeConfirmToken", "sourceOneKeyIdAuthToken", "token（当前 OAuth）"],
                  notes: ["canonical source lock 按 sourceOneKeyUserId。", "source 不迁移业务数据到 target。"],
                },
                forkStyle: "list",
                branches: [
                  { label: "merged", tone: "ok", nodes: [{
                    id: "s-done", type: "success", title: "完成：source 合并到 target",
                    subtitle: "source 标记 merged archive，source active OAuth bindings retarget 到 target，source session 撤销。",
                    detail: { returns: ["status: merged", "mergeExecution（source/target OneKeyUserId）", "onekeySession（target）", "bindReason = merged_source_retarget"], notes: ["其他被 retarget 的 OAuth identities 体现在 onekeyAccount.identities。流程结束。"] },
                  }] },
                  { label: "processing", tone: "warn", nodes: [{
                    id: "s-processing", type: "info", title: "处理中",
                    subtitle: "同 mergeRequestId 执行中。",
                    detail: { returns: ["status: processing", "retryAfterSeconds"], notes: ["短时间后重试，processing 超时需服务端状态对账。"] },
                  }] },
                  { label: "failed", tone: "no", nodes: [{
                    id: "s-failed", type: "error", title: "failed",
                    subtitle: "执行失败并落库。",
                    detail: { notes: ["不要自动重试。"] },
                  }] },
                  { label: "support_required", tone: "no", nodes: [{
                    id: "s-support", type: "error", title: "support_required",
                    subtitle: "需客服 / 风控介入。",
                    detail: { notes: ["account_merged_reauth_required 时清理本地 session，不要靠 mergeRequestId 找回登录态。"] },
                  }] },
                ],
              },
            ],
          },
          {
            label: "OTP 错误 / 过期",
            tone: "no",
            nodes: [{
              id: "s-otp-error", type: "error", title: "merge_otp_invalid / merge_otp_expired",
              subtitle: "OTP 不匹配或已过期。",
              detail: { notes: ["可重发或重走 API-05。"] },
            }],
          },
        ],
      },
    ],
  },
];
