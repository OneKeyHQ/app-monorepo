/**
 * 完整流程内容数据，来源：server-apis.md / api-01 / api-03 / api-04-05-06-09 examples / plan.md。
 * 由 flows-fill-gaps workflow 按覆盖度审计全量补全（错误码 → detail.errors；业务规则 → detail.notes）。
 * 节点 type：pre 前置 / api 接口 / user 用户操作 / success 成功 / error 错误 / info 待合并中间态。
 */
window.FLOW_META = {
  "colors": {
    "pre": "#64748b",
    "api": "#2563eb",
    "user": "#7c3aed",
    "success": "#16a34a",
    "error": "#dc2626",
    "info": "#d97706"
  },
  "tags": {
    "pre": "前置条件",
    "api": "接口调用",
    "user": "用户操作",
    "success": "成功",
    "error": "错误 / 终止",
    "info": "待合并 / 中间态"
  }
};

window.FLOW_SCOPE = "本图覆盖服务端 API 调用链与账号合并分支（API-01/03/04/05/06/09），含各阶段错误码与关键业务规则。不含客户端钱包生命周期（Keyless lazy create / PIN）、Cloud Sync、用户分群 UI、本地 bindingStatus 缓存态等纯客户端行为——这些见 plan.md 客户端章节，与本图正交，仅在相关节点以 note 提示。";

window.FLOWS = [
  {
    "id": "oauth-login",
    "tab": "API-01 OAuth 登录",
    "title": "API-01 · OAuth 登录 / Upsert",
    "summary": "用户用 Google / Apple 登录。服务端在同一个 upsert 入口完成 OAuth identity 校验、登录 / 创建 OneKeyID、同 verified email 自动绑定，必要时返回 manual_merge_required 进入显式合并。登录只建立 OneKeyID 登录态，绝不触碰 Keyless wallet / PIN。",
    "blocks": [
      {
        "id": "pre-login",
        "type": "pre",
        "title": "前置：用户未登录，要建立 OneKeyID 登录态",
        "subtitle": "新用户 / 新设备 / 已登出，用户点 Google 或 Apple 登录。本地可能残留一个旧 legacy OneKeyID 登录态（可作防分叉信号），也可能没有。",
        "detail": {
          "notes": [
            "【关键·不碰 Keyless】OAuth 登录成功只建立 OneKeyID 登录态：不创建、不恢复 Keyless wallet，不建立 Keyless → OneKeyID 关系，绝不在登录流程要求 Keyless PIN。只有用户主动进入 Keyless 能力（创建 / 使用 Keyless wallet）时才进 PIN。",
            "客户端启动只读本地状态，不静默登录、不自动调用 API-01、不弹 PIN；是否登录由用户主动操作决定。",
            "legacy 未登录时，登录页展示「Continue with existing Keyless wallet」入口，复用本地已存在的 credential，不触发服务端同步、不弹 PIN。",
            "新用户的 Keyless wallet 走 lazy create：仅在用户主动需要时创建，登录本身不触发 Keyless 同步 / 创建。",
            "有可验证 legacy 登录态时，客户端把它作为 legacyOneKeyIdAuthToken 一并提交（仅防分叉信号，不是绑定 proof）。",
            "已登录 legacy email OneKeyID、想主动加 OAuth 登录方式的，走 API-03（见对应标签），不走这里。"
          ]
        }
      },
      {
        "id": "login-start",
        "type": "api",
        "title": "POST /account/oauth/login",
        "subtitle": "客户端提交 OAuth Supabase access token；本地有可验证旧 OneKeyID 时附带 legacyOneKeyIdAuthToken（仅防分叉信号）。服务端判定归属，产出以下其一。",
        "detail": {
          "params": [
            "token（OAuth Supabase access token）",
            "legacyOneKeyIdAuthToken?（可选防分叉信号，非绑定 proof）"
          ],
          "returns": [
            "oauthIdentity（始终返回）",
            "status = success | manual_merge_required"
          ],
          "errors": [
            "account_merged_reauth_required: OAuth binding 指向 merged source、retarget 不完整 → 清理本地 OneKeyID Supabase session / primePersistAtom，回登录页手动重登，不能自动重试、不能把 source 透明切到 target。",
            "support_required: 无法自动判定的数据异常（如同 email 命中多个 active OneKeyID / email claim 迁移不完整）→ 不写 session、不设 isLoggedInOnServer=true、不建新 OneKeyID、不进登录态、不自动选 target，展示客服入口。",
            "oauth_credential_invalid: OAuth token 无效 / 过期 / oauthProvider 不匹配 / 无法验证 → 清理本次登录产生的临时 credential / OneKeyID session 状态，回登录页手动重新发起 Google / Apple 登录，客户端不能用当前 token 自动重试。"
          ],
          "notes": [
            "status 全集仅 success / manual_merge_required；status=success 只能对应 active 账号。",
            "命中 merged 账号绝不作为成功返回，必须走 account_merged_reauth_required 错误分支（active / merged 语义分离）。",
            "API-01 不接收 legacy Email OTP。",
            "同 verified email 的自动绑定必须在这里完成，不进入 pending merge。",
            "legacyOneKeyIdAuthToken 即使验证通过，也只触发 manual_merge_required，绝不直接绑定。",
            "终止类错误（account_merged_reauth_required / support_required / oauth_credential_invalid）走 error code，不放在 status，客户端不能按 IOneKeyIdOAuthLoginResponse 解析 data。"
          ]
        },
        "groups": [
          {
            "title": "自动完成 · 直接登录 / 创建",
            "tone": "ok",
            "branches": [
              {
                "label": "① OAuth identity 已有 active binding",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "ok-existing",
                    "type": "success",
                    "title": "正常登录已绑定账号（Ex01）",
                    "subtitle": "直接登录原 OneKeyID，返回 active session。",
                    "detail": {
                      "returns": [
                        "status: success",
                        "onekeySession",
                        "onekeyAccount(active)",
                        "bindReason = existing_oauth_binding"
                      ],
                      "notes": [
                        "只建立 OneKeyID 登录态，不创建 / 恢复 Keyless wallet、不弹 PIN。流程结束。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "② 未绑定 · verified email 命中 legacy OneKeyID",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "ok-legacy",
                    "type": "success",
                    "title": "同 email 自动绑定 legacy（Ex02）",
                    "subtitle": "verified normalizedEmail 命中唯一 active legacy OneKeyID，自动绑定。",
                    "detail": {
                      "returns": [
                        "status: success",
                        "onekeyAccount 含 legacy_email + oauth",
                        "bindReason = legacy_email_auto_bind"
                      ],
                      "notes": [
                        "不要求 legacy Email OTP。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "③ 未绑定 · verified email 命中 active email claim owner",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "ok-claim",
                    "type": "success",
                    "title": "email claim 自动绑定（Ex03）",
                    "subtitle": "无 legacy 命中时，命中唯一 active email claim owner。",
                    "detail": {
                      "returns": [
                        "status: success",
                        "bindReason = email_claim_auto_bind"
                      ],
                      "notes": [
                        "服务端通过 normalizedEmail 的唯一 email claim 归属，不是客户端比较两个 OAuth 账号。",
                        "同一 OneKeyID 下多个 OAuth identity 指向同一 email 不算冲突（含多设备 Keyless OAuth identity 指向同一 legacy email），它们通过同一 email claim 归属到同一 owner。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "④ 未命中任何 legacy / email claim",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "ok-new",
                    "type": "success",
                    "title": "创建新的 OAuth OneKeyID（Ex04）",
                    "subtitle": "无 binding、无同 email 目标、无合法 legacy token。",
                    "detail": {
                      "returns": [
                        "status: success",
                        "新 onekeyUserId",
                        "bindReason = new_oauth_account_created"
                      ],
                      "notes": [
                        "新建 OneKeyID 登录态；Keyless wallet 仍走 lazy create，登录不触发同步 / 创建、不弹 PIN。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑤ 无 verified email（如 Apple 未返回）且无合法 legacy token",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "ok-oauthonly",
                    "type": "success",
                    "title": "创建 OAuth-only OneKeyID（Ex05）",
                    "subtitle": "oauthEmailType = missing_or_unverified。",
                    "detail": {
                      "returns": [
                        "status: success",
                        "bindReason = new_oauth_account_created"
                      ],
                      "notes": [
                        "不创建 email claim，不参与同 email 自动绑定。"
                      ]
                    }
                  }
                ]
              }
            ]
          },
          {
            "title": "转入显式合并（manual_merge_required）",
            "tone": "warn",
            "branches": [
              {
                "label": "⑥ email mismatch + 有合法 legacy token",
                "tone": "warn",
                "nodes": [
                  {
                    "id": "mm-mismatch",
                    "type": "info",
                    "title": "manual_merge_required（Ex06）",
                    "subtitle": "OAuth verified email 与本地 legacy 账号不一致，不能静默绑定。",
                    "goto": "merge-pending",
                    "detail": {
                      "returns": [
                        "status: manual_merge_required",
                        "sourceType = pending_oauth_bind",
                        "reason = oauth_email_mismatch",
                        "pendingOAuthBindToken, expiresAt"
                      ],
                      "notes": [
                        "2xx workflow status，非错误。后续走 /merge/prepare。",
                        "manual_merge_required 不写普通登录态：不设 isLoggedInOnServer=true、不签发 session、不创建新 OneKeyID，只保存 pendingOAuthBindToken 进 pending merge state。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑦ Apple private relay + 有合法 legacy token",
                "tone": "warn",
                "nodes": [
                  {
                    "id": "mm-relay",
                    "type": "info",
                    "title": "manual_merge_required（Ex07）",
                    "subtitle": "private relay email 不能自动合并到真实 legacy email。",
                    "goto": "merge-pending",
                    "detail": {
                      "returns": [
                        "reason = apple_private_relay",
                        "pendingOAuthBindToken"
                      ],
                      "notes": [
                        "无合法 legacy token 时改为创建独立 OAuth OneKeyID。",
                        "manual_merge_required 不写普通登录态：不设 isLoggedInOnServer=true、不建新 OneKeyID，仅进 pending merge state。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑧ 无 verified email + 有合法 legacy token",
                "tone": "warn",
                "nodes": [
                  {
                    "id": "mm-missing",
                    "type": "info",
                    "title": "manual_merge_required（Ex08）",
                    "subtitle": "OAuth credential 无 verified email，不能参与同 email 自动绑定。",
                    "goto": "merge-pending",
                    "detail": {
                      "returns": [
                        "reason = missing_or_unverified_email",
                        "pendingOAuthBindToken"
                      ],
                      "notes": [
                        "无合法 legacy token 时改为创建 OAuth-only OneKeyID。",
                        "manual_merge_required 不写普通登录态：不设 isLoggedInOnServer=true、不建新 OneKeyID，仅进 pending merge state。"
                      ]
                    }
                  }
                ]
              }
            ]
          },
          {
            "title": "终止 / 错误（error code）",
            "tone": "no",
            "branches": [
              {
                "label": "⑨ OAuth binding 指向 merged source",
                "tone": "no",
                "nodes": [
                  {
                    "id": "err-merged",
                    "type": "error",
                    "title": "account_merged_reauth_required（Ex09）",
                    "subtitle": "binding retarget 不完整，拒绝签发 source 普通 session。",
                    "detail": {
                      "returns": [
                        "code: account_merged_reauth_required"
                      ],
                      "notes": [
                        "客户端清理本地 session / primePersistAtom，回登录页让用户手动重登；不能自动重试，也不能把 source 透明切到 target。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑩ OAuth credential 无效 / 过期 / provider 不匹配",
                "tone": "no",
                "nodes": [
                  {
                    "id": "oauth_credential_invalid",
                    "type": "error",
                    "title": "oauth_credential_invalid",
                    "subtitle": "OAuth token 无效、过期、oauthProvider 不匹配或无法验证。",
                    "detail": {
                      "returns": [
                        "code: oauth_credential_invalid"
                      ],
                      "notes": [
                        "客户端清理本次登录产生的临时 credential / OneKeyID session 状态，回登录页让用户手动重新发起 Google / Apple 登录。",
                        "不能用当前 token 自动重试本接口。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑪ 合并 / 绑定数据异常",
                "tone": "no",
                "nodes": [
                  {
                    "id": "err-support",
                    "type": "error",
                    "title": "support_required（Ex10）",
                    "subtitle": "无法自动处理的数据异常（如同 email 命中多个 active OneKeyID）。",
                    "detail": {
                      "returns": [
                        "code: support_required",
                        "data.reason 如 duplicate_legacy_email"
                      ],
                      "notes": [
                        "不写 session、不设 isLoggedInOnServer=true、不建账号、不进登录态、不自动选 target；展示客服入口。"
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "legacy-upgrade",
    "tab": "API-03 Legacy 升级",
    "title": "API-03 · Legacy OneKeyID 升级到 OAuth 登录",
    "summary": "当前已登录 legacy email OneKeyID 的用户，在 Account Security / Login methods 主动点 Upgrade with Google / Apple，把 OAuth identity 绑定到该 legacy email OneKeyID。没有第二个账号参与，不做 merge。同时校验 OAuth token + legacyOneKeyIdAuthToken 两份 proof，不要求 legacy Email OTP。",
    "blocks": [
      {
        "id": "pre-upgrade",
        "type": "pre",
        "title": "前置：已登录 legacy email OneKeyID",
        "subtitle": "用户当前持有 legacy email OneKeyID 的有效 session（升级前遗留或兼容期保留），在 Account Security / Login methods 主动点 Upgrade with Google / Apple。",
        "detail": {
          "notes": [
            "主场景：当前已登录 legacy email OneKeyID，用户主动点 Upgrade with Google / Apple，把该账号升级到 OAuth 登录方式。",
            "迁移场景：用户在 Keyless create / restore / upgrade 前，需要先把当前 Google / Apple OAuth identity 归属到这个 legacy email OneKeyID，也走 API-03。",
            "没有 legacy session 的用户不能走 API-03：新版本客户端不提供 legacy Email + OTP 登录入口，应先 API-01 OAuth 登录，再走 API-04~06 显式合并。"
          ]
        }
      },
      {
        "id": "bind-start",
        "type": "api",
        "title": "POST /account/identities/oauth/bind",
        "subtitle": "同时提交 OAuth token + legacyOneKeyIdAuthToken（必填 target proof）。两份 proof 都验证通过才绑定，不需要 legacy Email OTP。",
        "detail": {
          "params": [
            "token（当前要升级的 OAuth Supabase access token）",
            "legacyOneKeyIdAuthToken（必填 target proof，指定要绑定到哪个 legacy email OneKeyID）"
          ],
          "returns": [
            "status: success（2xx 实际只返回 success，不返回 manual_merge_required）",
            "oauthIdentity（OAuth token 解析出的 identity 摘要）",
            "onekeyAccount（target legacy email OneKeyID，identities 含本次绑定的 OAuth identity）",
            "oauthIdentityBinding（bindingStatus 固定 bound）",
            "不返回新的 onekeySession：客户端已持有 target legacy email OneKeyID session"
          ],
          "notes": [
            "target legacy OneKeyID 必须来自 body 的 legacyOneKeyIdAuthToken，不能从 X-Onekey-Request-Token 或隐式登录态推断。",
            "完成的是升级到 OAuth 登录方式，不是绑定 legacy email、也不是合并两个 OneKeyID account；没有第二个账号参与，不会把任何 OneKeyID 标记为 merged。",
            "不是 API-01 manual_merge_required 的后续接口，也不参与普通登录流程。",
            "同 email / 跨 email / Apple private relay / 无 verified email OAuth identity 都使用同一套 proof：legacyOneKeyIdAuthToken + OAuth token，不要求 legacy Email OTP。",
            "Keyless 场景：同 email 在本接口内静默绑定；跨 email 仍走 API-03 双 token 授权绑定；绑定不要求 Keyless PIN。",
            "绑定不使用 Keyless metadata 作认证材料；只用 OAuth token + legacyOneKeyIdAuthToken 两份 proof。",
            "绑定不写入本地 Keyless wallet 关系，也不建立 OneKeyID 到 keylessWalletId 的服务端归属关系。"
          ]
        },
        "groups": [
          {
            "title": "绑定成功",
            "tone": "ok",
            "branches": [
              {
                "label": "① OAuth identity 已绑定到该 legacy OneKeyID",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "u-existing",
                    "type": "success",
                    "title": "幂等返回成功（Ex01）",
                    "subtitle": "已存在 active binding，直接返回。",
                    "detail": {
                      "returns": [
                        "bindingStatus = bound",
                        "bindReason = existing_oauth_binding"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "② legacy email == OAuth verified email",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "u-same",
                    "type": "success",
                    "title": "静默绑定成功（Ex02）",
                    "subtitle": "OAuth verified email 直接命中该 legacy email OneKeyID 的 legacy_email identity，自动绑定。",
                    "detail": {
                      "returns": [
                        "bindingStatus = bound",
                        "bindReason = legacy_email_auto_bind"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "③ verified email 的 active claim owner 即该 legacy OneKeyID",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "u-claim-auto",
                    "type": "success",
                    "title": "email claim 自动绑定成功",
                    "subtitle": "当前未绑定的 OAuth identity 的 verified normalizedEmail 命中 active email claim，且 owner 正是该 legacy OneKeyID，服务端按 normalizedEmail 唯一 email claim 自动归属。",
                    "detail": {
                      "returns": [
                        "bindingStatus = bound",
                        "bindReason = email_claim_auto_bind"
                      ],
                      "notes": [
                        "服务端按 normalizedEmail 的唯一 email claim 做归属判断，不是客户端直接比较两个 OAuth 账号。",
                        "legacy_email identity 直接命中时优先返回 legacy_email_auto_bind；只有命中的是 email claim owner 才返回 email_claim_auto_bind。",
                        "与错误码 oauth_email_claim_conflict 区分：此处 claim owner 就是 target legacy OneKeyID 才成功；owner 是别的账号则返回该错误码。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "④ OAuth email ≠ legacy email（跨 email）",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "u-cross",
                    "type": "success",
                    "title": "双 token 授权绑定（Ex03）",
                    "subtitle": "OAuth token + legacy token 同时验证通过，跨 email 绑定。",
                    "detail": {
                      "returns": [
                        "bindingStatus = bound",
                        "bindReason = legacy_session_authorized_bind"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑤ Apple private relay identity",
                "tone": "ok",
                "nodes": [
                  {
                    "id": "u-relay",
                    "type": "success",
                    "title": "双 token 授权绑定（Ex04）",
                    "subtitle": "private relay / 无 verified real email 也可通过双 token 授权绑定。",
                    "detail": {
                      "returns": [
                        "bindingStatus = bound",
                        "bindReason = legacy_session_authorized_bind"
                      ]
                    }
                  }
                ]
              }
            ]
          },
          {
            "title": "须转显式合并",
            "tone": "warn",
            "branches": [
              {
                "label": "⑥ OAuth identity 已绑定到另一个 OneKeyID",
                "tone": "warn",
                "nodes": [
                  {
                    "id": "u-bound-other",
                    "type": "error",
                    "title": "oauth_identity_bound_to_another_account（Ex05）",
                    "subtitle": "当前 OAuth identity 已绑定到另一个 active OneKeyID，本接口不能强行转移到 target legacy OneKeyID。",
                    "goto": "merge-source",
                    "detail": {
                      "errors": [
                        "oauth_identity_bound_to_another_account: 当前 OAuth identity 已有 active binding 在 OneKeyID A → 客户端不能用 API-03 转移；要把 A 的 OAuth identity 转移到 legacy email OneKeyID B 须走 API-04 / 05 / 06，最终由 API-06 改写 binding；也可提示切换账号或联系支持。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑦ verified email 的 active claim owner 是别的账号",
                "tone": "warn",
                "nodes": [
                  {
                    "id": "u-claim-conflict",
                    "type": "error",
                    "title": "oauth_email_claim_conflict",
                    "subtitle": "当前 OAuth verified email 的 active email claim owner 不是 target legacy OneKeyID，服务端不能覆盖该 claim。",
                    "goto": "merge-source",
                    "detail": {
                      "errors": [
                        "oauth_email_claim_conflict: verified normalizedEmail 的 active email claim owner 不是 legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID → 客户端进入显式账号合并或客服流程，不在本接口覆盖 claim。"
                      ]
                    }
                  }
                ]
              }
            ]
          },
          {
            "title": "终止 / 错误",
            "tone": "no",
            "branches": [
              {
                "label": "⑧ target 不是 legacy email OneKeyID",
                "tone": "no",
                "nodes": [
                  {
                    "id": "u-need-legacy",
                    "type": "error",
                    "title": "oauth_bind_requires_legacy_email",
                    "subtitle": "target 没有 legacy_email identity（如 OAuth-only OneKeyID）。",
                    "detail": {
                      "errors": [
                        "oauth_bind_requires_legacy_email: legacyOneKeyIdAuthToken 对应的 target OneKeyID 不是 legacy email OneKeyID，或没有 legacy_email identity → 客户端不应展示该入口；API-03 只服务 legacy email OneKeyID 升级，不给 OAuth-only OneKeyID 添加另一个 OAuth provider。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑨ legacy session 失效",
                "tone": "no",
                "nodes": [
                  {
                    "id": "u-session-invalid",
                    "type": "error",
                    "title": "onekey_session_invalid",
                    "subtitle": "legacyOneKeyIdAuthToken 缺失、过期、被撤销或无法校验（401）。",
                    "detail": {
                      "errors": [
                        "onekey_session_invalid: legacyOneKeyIdAuthToken 缺失 / 过期 / 撤销 / 无法校验 → 客户端清理本地 legacy email OneKeyID session / primePersistAtom，回到登录界面。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑩ legacy 账号已是 merged source",
                "tone": "no",
                "nodes": [
                  {
                    "id": "u-merged-reauth",
                    "type": "error",
                    "title": "account_merged_reauth_required",
                    "subtitle": "legacyOneKeyIdAuthToken 对应的 legacy email OneKeyID 已是 merged source（401）。",
                    "detail": {
                      "errors": [
                        "account_merged_reauth_required: target legacy email OneKeyID 已被合并为 merged source → 客户端同 API-01：清理本地 session，报错并回到登录界面，让用户手动重新登录。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑪ OAuth credential 无效",
                "tone": "no",
                "nodes": [
                  {
                    "id": "u-oauth-invalid",
                    "type": "error",
                    "title": "oauth_credential_invalid",
                    "subtitle": "OAuth token 无效、过期、oauthProvider 不匹配或无法验证。",
                    "detail": {
                      "errors": [
                        "oauth_credential_invalid: OAuth token 无效 / 过期 / oauthProvider 不匹配 / 无法验证 → 客户端清理本次 OAuth 临时 credential，报错并让用户手动重新发起 OAuth。"
                      ]
                    }
                  }
                ]
              },
              {
                "label": "⑫ 历史数据异常",
                "tone": "no",
                "nodes": [
                  {
                    "id": "u-support",
                    "type": "error",
                    "title": "support_required",
                    "subtitle": "历史数据存在无法自动判定的问题（OAuth binding / email claim 唯一性异常等）。",
                    "detail": {
                      "errors": [
                        "support_required: OAuth binding / email claim 唯一性等历史数据异常无法自动判定 → 客户端展示客服 / 风控处理入口。"
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "merge-pending",
    "tab": "合并 · pending",
    "title": "显式合并 · pending_oauth_bind（来自 manual_merge_required）",
    "summary": "API-01 返回 manual_merge_required 后继续。还没有 source OneKeyID；target 来自 pendingOAuthBindToken 已签入的 legacy 上下文，用户不再输入 target email。完成 legacy Email OTP 后，API-06 把当前 OAuth identity 绑定到 target legacy OneKeyID。",
    "blocks": [
      {
        "id": "pre-pending",
        "type": "pre",
        "title": "前置：API-01 返回 manual_merge_required",
        "subtitle": "用户刚用 Google / Apple 登录（API-01）并提交了可验证 legacyOneKeyIdAuthToken，但 OAuth email 无法自动归属，服务端返回 pendingOAuthBindToken，客户端进入 pending merge state。",
        "goto": "oauth-login",
        "detail": {
          "notes": [
            "reason ∈ oauth_email_mismatch / apple_private_relay / missing_or_unverified_email。",
            "还没有 source OneKeyID；target legacy OneKeyID 已签入 pendingOAuthBindToken。",
            "同 verified email 已在 API-01 自动绑定；pending_oauth_bind 不是同 email 绑定场景，只覆盖无法安全自动归属的情况。"
          ]
        }
      },
      {
        "id": "p-prepare",
        "type": "api",
        "title": "API-04 POST /merge/prepare",
        "subtitle": "预检查并签发 OTP purpose；不发 OTP、不创建 merge request。",
        "detail": {
          "params": [
            "pendingOAuthBindToken（来自 API-01）"
          ],
          "returns": [
            "otpScene = MergeExistingOneKeyId",
            "otpPurposeToken",
            "targetLegacyDisplayEmail",
            "expiresAt"
          ],
          "errors": [
            "merge_source_invalid: pendingOAuthBindToken 缺失/过期/验签失败 → 客户端丢弃 pending 上下文，重走 API-01 OAuth 登录。",
            "merge_target_email_invalid: pending_oauth_bind 路径误传了不应出现的 targetLegacyEmail → 客户端修正请求，本路径不得提交 targetLegacyEmail（target 从 token 解析）。",
            "merge_prepare_rate_limited: 按 source/target email/设备/IP 维度触发合并预检查限频 → 客户端退避后重试，展示稍后再试。",
            "source_merge_in_progress: 同一 canonical source 已有未完成合并执行 → 客户端提示正在处理，不要重复发起 prepare。",
            "support_required: 历史数据无法自动判定 → 展示客服 / 风控入口。"
          ],
          "notes": [
            "target 从 token 解析，本路径不能提交 targetLegacyEmail，也不能让用户重新输入 target email。",
            "不持久化 pending merge 状态，只签发短期 otpPurposeToken。",
            "OTP 完成前不暴露 target 是否存在、target onekeyUserId 或账号摘要（防枚举）。"
          ]
        }
      },
      {
        "id": "p-otp",
        "type": "api",
        "title": "API-09 POST /general/emailOTP",
        "subtitle": "发送 target legacy Email OTP。只发码，不做业务判断。",
        "detail": {
          "params": [
            "scene = MergeExistingOneKeyId",
            "otpPurposeToken（来自 API-04）"
          ],
          "returns": [
            "resendAt",
            "uuid（后续作为 API-05 的 otpUuid 提交）"
          ],
          "errors": [
            "otp_purpose_token_required: scene = MergeExistingOneKeyId 但缺少 otpPurposeToken → 客户端补传 API-04 返回的 otpPurposeToken。",
            "otp_purpose_token_invalid: otpPurposeToken 无效 / 过期，或 scene 不匹配 → 客户端重走 API-04 获取新 otpPurposeToken。",
            "email_otp_rate_limited: 发码频率限制 → 客户端按 resendAt 冷却后再发，且保持防枚举语义。",
            "email_otp_scene_invalid: scene 不存在或不允许当前调用方使用 → 客户端检查 scene 取值。"
          ],
          "notes": [
            "API-09 只发送 OTP，不判断是否允许合并；业务确认由 API-05 完成。",
            "验签后按 token 内 target legacy email 发码或返回中性结果，不能通过错误码 / 文案 / 时序泄露 target 是否存在。",
            "旧 scene 请求 / 响应语义保持兼容；otpPurposeToken 只在 MergeExistingOneKeyId 必填，不能让旧 scene 因缺字段失败。"
          ]
        }
      },
      {
        "id": "p-verify",
        "type": "api",
        "title": "API-05 POST /merge/verify-target",
        "subtitle": "用户输入 OTP，验证 target 并生成短期 confirm proof；仍不执行绑定。",
        "decision": "OTP 是否通过？",
        "detail": {
          "params": [
            "pendingOAuthBindToken",
            "otpPurposeToken",
            "otpUuid",
            "otpCode"
          ],
          "returns": [
            "source（摘要）",
            "targetOneKeyAccount",
            "mergeRequestId",
            "mergeConfirmToken",
            "expiresAt"
          ],
          "errors": [
            "merge_source_invalid: source proof 无效，含 pendingOAuthBindToken 过期 / 验签失败 → 客户端重走 API-01 OAuth 登录。",
            "source_merge_in_progress: 同一 canonical source 已有未完成合并执行 → 客户端提示处理中，不要重复 verify。",
            "support_required: 历史数据无法自动判定 → 展示客服 / 风控入口。"
          ],
          "notes": [
            "重新校验 source proof，不能只相信 API-04 的 otpPurposeToken。",
            "确认 pendingOAuthBindToken 与 otpPurposeToken 指向同一 target legacy OneKeyID / normalized email。",
            "verify-target 返回的 source 摘要供确认页展示，且必须与 API-06 canonical source 一致。",
            "OTP 通过后若 target 不满足合并 target 条件，返回 merge_target_invalid。"
          ]
        },
        "branches": [
          {
            "label": "OTP 通过",
            "tone": "ok",
            "nodes": [
              {
                "id": "p-confirm-page",
                "type": "user",
                "title": "确认页：用户二次确认",
                "subtitle": "展示将把哪个 OAuth identity 绑定到哪个 legacy OneKeyID。明确：没有 source OneKeyID、不迁移 source 数据。",
                "detail": {
                  "notes": [
                    "客户端不能在 OTP 成功后自动执行，必须等用户点确认。",
                    "确认页明确：还没有 source OneKeyID，不会迁移 source 数据；成功后只把与 canonical source 一致的 OAuth identity 绑定到 target。"
                  ]
                }
              },
              {
                "id": "p-confirm",
                "type": "api",
                "title": "API-06 POST /merge/confirm",
                "subtitle": "最终绑定执行（唯一写入点）。重新校验 mergeConfirmToken + source proof + 当前 OAuth token，按 mergeRequestId 幂等。",
                "decision": "执行结果 status？",
                "detail": {
                  "params": [
                    "mergeRequestId",
                    "mergeConfirmToken",
                    "pendingOAuthBindToken",
                    "token（当前 OAuth）"
                  ],
                  "errors": [
                    "merge_request_not_found: mergeRequestId 不存在，或请求方无权感知该 execution record（source proof 校验失败也可统一返回该错误 / 404）→ 客户端重走 API-05。",
                    "merge_confirm_expired: mergeConfirmToken 已过期且还没有 execution record → 客户端重走 API-05 获取新的 mergeRequestId + mergeConfirmToken。",
                    "merge_source_invalid: source proof 无效（pendingOAuthBindToken 失效）→ 客户端重走 API-01 OAuth 登录。",
                    "oauth_credential_invalid: 当前 OAuth token 无效 / 过期 / 被撤销，或与 source proof 不匹配 → 客户端重新获取 OAuth token 并重走 API-05。",
                    "oauth_credential_mismatch: OAuth token 有效但解析出的 identity 与确认页 canonical source 不一致（用户在 API-05 后切换了 OAuth credential）→ 客户端丢弃当前 confirm 上下文，重走 API-05，不得继续用旧确认页结果合并新 identity。",
                    "source_merge_in_progress: 同一 canonical source 已有未完成 processing relation → 客户端转到 processing 等待，不重复创建执行记录。",
                    "account_merged_reauth_required: source 对应 OAuth OneKeyID 已是 merged source → 客户端清理本地 session，回登录界面，不靠 mergeRequestId 找回登录态。",
                    "support_required: 历史数据无法自动判定 → 展示客服 / 风控入口。"
                  ],
                  "notes": [
                    "canonical source execution lock key = oauthProvider + oauthSubject（pending_oauth_bind）。",
                    "mergeRequestId 非授权凭证、非 secret，不能作为用户恢复登录路径。",
                    "执行期状态查询须校验 proof，失败统一返回 404 / not found 防枚举。",
                    "mergeConfirmToken 过期且无 execution record → 不开始新执行，返回 merge_confirm_expired，重走 API-05。",
                    "confirm 时切换了 OAuth credential → oauth_credential_mismatch，须重走 API-05。",
                    "OAuth identity 有 verified email 时在同事务为该 email 创建 / 迁移 active email claim 到 target。"
                  ]
                },
                "forkStyle": "list",
                "branches": [
                  {
                    "label": "merged",
                    "tone": "ok",
                    "nodes": [
                      {
                        "id": "p-done",
                        "type": "success",
                        "title": "完成：绑定到 target legacy OneKeyID",
                        "subtitle": "返回 target session，客户端刷新 primePersistAtom。",
                        "detail": {
                          "returns": [
                            "status: merged",
                            "onekeySession",
                            "onekeyAccount（含 legacy_email + oauth）",
                            "bindReason = manual_merge_confirmed_bind"
                          ],
                          "notes": [
                            "不创建 source OneKeyID。流程结束。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "processing",
                    "tone": "warn",
                    "nodes": [
                      {
                        "id": "p-processing",
                        "type": "info",
                        "title": "处理中（Ex03 重试）",
                        "subtitle": "同 mergeRequestId 已在执行中。",
                        "detail": {
                          "returns": [
                            "status: processing",
                            "retryAfterSeconds"
                          ],
                          "notes": [
                            "短时间后用同 mergeRequestId 重试，不重复执行。",
                            "processing 超时由服务端做状态对账：检查 OAuth binding 是否已指向 target、source status、target merge relation、identity retarget 子表。",
                            "对账确认已完成 → 更新为 merged 返回成功；确认尚未执行 → 重新锁定并继续执行；无法判断 → 更新为 support_required。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "failed",
                    "tone": "no",
                    "nodes": [
                      {
                        "id": "p-failed",
                        "type": "error",
                        "title": "failed",
                        "subtitle": "执行失败且已落库失败记录。",
                        "detail": {
                          "notes": [
                            "客户端不要自动重试。",
                            "服务端在独立审计事务中把 execution record 更新为 failed，保留结构化失败记录。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "support_required",
                    "tone": "no",
                    "nodes": [
                      {
                        "id": "p-support",
                        "type": "error",
                        "title": "support_required",
                        "subtitle": "无法自动判定，需客服 / 风控介入。",
                        "detail": {
                          "notes": [
                            "展示客服入口。",
                            "execution record 更新为 support_required，保留结构化记录。"
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "label": "OTP 错误 / 过期",
            "tone": "no",
            "nodes": [
              {
                "id": "p-otp-error",
                "type": "error",
                "title": "merge_otp_invalid / merge_otp_expired",
                "subtitle": "OTP 不匹配（merge_otp_invalid）或 OTP / otpPurposeToken 已过期（merge_otp_expired）。",
                "detail": {
                  "errors": [
                    "merge_otp_invalid: OTP uuid / code 不匹配 → 客户端提示重输，可重发 OTP（API-09）。",
                    "merge_otp_expired: OTP 或 otpPurposeToken 已过期 → 客户端重走 API-04 + API-09 重新发码。",
                    "support_required: 历史数据无法自动判定 → 展示客服 / 风控入口。"
                  ],
                  "notes": [
                    "可重发 OTP 或重新走 API-05。",
                    "merge_source_invalid / source_merge_in_progress 属于 API-05 source 阶段错误，不在 OTP 错误这里展示。"
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "id": "merge-source",
    "tab": "合并 · source",
    "title": "显式合并 · merged_source（已登录 OAuth 主动合并）",
    "summary": "用户已登录 OAuth OneKeyID，从低曝光入口 Merge existing OneKeyID 主动把它合并到 target legacy email OneKeyID。存在两个 OneKeyID：source（当前 OAuth）+ target（legacy email）。完成 legacy Email OTP 验证 + 二次确认后，API-06 把 source 标记 merged archive，并把 source active OAuth bindings retarget 到 target。",
    "blocks": [
      {
        "id": "pre-source",
        "type": "pre",
        "title": "前置：已登录 OAuth OneKeyID，想合并旧账号",
        "subtitle": "用户已用 OAuth 登录并持有 active OAuth OneKeyID（可能是 API-01 新建的），从低曝光入口 Merge existing OneKeyID 主动发起，把它合并到某个 legacy email OneKeyID。",
        "goto": "oauth-login",
        "detail": {
          "notes": [
            "存在两个 OneKeyID：source（当前 OAuth）+ target（legacy email）。",
            "source 须为 active OAuth OneKeyID，不能传 target legacy 的 token。",
            "合并规则：显式合并入口只接受 target 是 legacy email OneKeyID 的请求；不支持 OAuth-only → OAuth-only 跨 email 合并。",
            "合并规则：两者均无 legacyEmail（OAuth-only → OAuth-only）不提供自助合并入口，也不进入客服流程；用户统一 logout 后用另一 provider 重新登录在两个账号间切换。",
            "合并规则：同 verified normalizedEmail 的多个 OAuth identity 仍走 API-01 同 email 自动合并，不走本流程，也不走客服。",
            "合并规则：同一个 normalizedLegacyEmail 命中多个 active legacy OneKeyID（无法回填唯一 owner）视为历史数据异常 → support_required，需人工修复。"
          ]
        }
      },
      {
        "id": "s-input",
        "type": "user",
        "title": "入口：用户输入 target legacy email",
        "subtitle": "在 Merge existing OneKeyID 入口输入要合并到的 legacy email。",
        "detail": {
          "notes": [
            "source 是当前已登录 OAuth OneKeyID session。",
            "target 必须是 legacy email OneKeyID；OAuth-only target 不在本入口受理范围。"
          ]
        }
      },
      {
        "id": "s-prepare",
        "type": "api",
        "title": "API-04 POST /merge/prepare",
        "subtitle": "校验 source 为 active OAuth OneKeyID，规范化 target email，签发 OTP purpose。",
        "detail": {
          "params": [
            "sourceOneKeyIdAuthToken（当前 OAuth OneKeyID token）",
            "targetLegacyEmail（用户输入，必填）"
          ],
          "returns": [
            "otpScene = MergeExistingOneKeyId",
            "otpPurposeToken",
            "targetLegacyDisplayEmail（masked）",
            "expiresAt（过期后须重新调用 API-04）"
          ],
          "errors": [
            "merge_source_invalid: sourceOneKeyIdAuthToken 缺失/过期/撤销/不是 active OAuth OneKeyID（含误传 target legacy token）→ 重新校验登录态，必要时重新 OAuth 登录。",
            "merge_target_email_invalid: merged_source 路径下 targetLegacyEmail 缺失/格式非法/无法规范化 → 提示用户重新输入合法 legacy email。",
            "merge_prepare_rate_limited: 按 source/target email/设备/IP 维度触发预检查限频 → 展示稍后重试，保持防枚举中性文案。",
            "source_merge_in_progress: 同一 canonical source 已有未完成合并执行 → 提示已有任务未完成，不重复发起。",
            "support_required: 历史数据无法自动判定 → 展示客服入口。"
          ],
          "notes": [
            "不能传 target legacy OneKeyID 的 token。",
            "OTP 验证前不返回 target 是否存在、target onekeyUserId、target/source 摘要（防枚举）。",
            "不持久化 pending merge request，只签发短期 otpPurposeToken。"
          ]
        }
      },
      {
        "id": "s-otp",
        "type": "api",
        "title": "API-09 POST /general/emailOTP",
        "subtitle": "发送 target legacy Email OTP。",
        "detail": {
          "params": [
            "scene = MergeExistingOneKeyId",
            "otpPurposeToken（API-04 签发，本 scene 必填）"
          ],
          "returns": [
            "resendAt",
            "uuid（后续 API-05 作为 otpUuid 提交）"
          ],
          "errors": [
            "otp_purpose_token_required: scene=MergeExistingOneKeyId 但缺少 otpPurposeToken → 客户端补传 API-04 返回的 otpPurposeToken。",
            "otp_purpose_token_invalid: otpPurposeToken 无效/过期或 scene 不匹配 → 重走 API-04 取新 otpPurposeToken。",
            "email_otp_rate_limited: 发码频率限制 → 等待 resendAt 后重发，保持防枚举中性文案，不暴露 target 是否存在。",
            "email_otp_scene_invalid: scene 不存在或不允许当前调用方使用 → 客户端按合并流程修正 scene。"
          ],
          "notes": [
            "API-09 只发码，不判断是否允许合并；业务确认由 API-05 完成。",
            "MergeExistingOneKeyId 必须验签 otpPurposeToken，并按 token 内 target email 发码或返回中性结果，不通过错误码/文案/时序泄露 target 是否存在。"
          ]
        }
      },
      {
        "id": "s-verify",
        "type": "api",
        "title": "API-05 POST /merge/verify-target",
        "subtitle": "验证 OTP，返回 source / target 摘要，生成 confirm proof；不执行合并。",
        "decision": "OTP 是否通过？",
        "detail": {
          "params": [
            "sourceOneKeyIdAuthToken",
            "targetLegacyEmail（须与 otpPurposeToken 中 target normalized email 一致）",
            "otpPurposeToken",
            "otpUuid",
            "otpCode"
          ],
          "returns": [
            "source.sourceType = merged_source + sourceOneKeyUserId",
            "targetOneKeyAccount（摘要，仅 OTP 通过后返回）",
            "mergeRequestId",
            "mergeConfirmToken",
            "expiresAt"
          ],
          "errors": [
            "merge_source_invalid: source proof 无效（sourceOneKeyIdAuthToken 过期/撤销/非 active OAuth OneKeyID）→ 重新校验登录态/重新 OAuth 登录。",
            "merge_otp_invalid: OTP uuid/code 不匹配 → 提示重新输入或重发 OTP。",
            "merge_otp_expired: OTP 或 otpPurposeToken 已过期 → 重发 OTP 或重走 API-04/API-05。",
            "merge_target_invalid: OTP 已验证但 target 不满足 legacy email OneKeyID 合并 target 条件（如 target 非 active legacy、OAuth-only target）→ 终止合并，必要时引导客服。",
            "source_merge_in_progress: 同一 canonical source 已有未完成合并执行 → 提示已有任务未完成，不重复发起。",
            "support_required: 历史数据无法自动判定 → 展示客服入口。"
          ],
          "notes": [
            "必须重新校验 source proof，不能只相信 API-04 的 otpPurposeToken。",
            "确认提交的 targetLegacyEmail 与 otpPurposeToken 中 target 一致。",
            "verify-target 返回的 source 摘要必须与 API-06 canonical source 保持一致，用于确认页展示。"
          ]
        },
        "branches": [
          {
            "label": "OTP 通过",
            "tone": "ok",
            "nodes": [
              {
                "id": "s-confirm-page",
                "type": "user",
                "title": "确认页：用户确认合并 source OneKeyID",
                "subtitle": "展示 source OAuth OneKeyID 与 target legacy OneKeyID，明确 source 将被标记 merged，source 下其他 active OAuth identities 也会一起 retarget 到 target。",
                "detail": {
                  "notes": [
                    "必须等用户确认才触发 API-06，客户端不能在 OTP 成功后自动执行。",
                    "确认页展示的 canonical source 一旦确认，确认后切换 OAuth credential 不能继续合并新 identity。"
                  ]
                }
              },
              {
                "id": "s-confirm",
                "type": "api",
                "title": "API-06 POST /merge/confirm",
                "subtitle": "最终合并执行（唯一写入点）。重新校验 mergeConfirmToken + source proof + 当前 OAuth token，确认其 identity 属于 source 且与 canonical source 一致，按 mergeRequestId 幂等。",
                "decision": "执行结果 status？",
                "detail": {
                  "params": [
                    "mergeRequestId",
                    "mergeConfirmToken",
                    "sourceOneKeyIdAuthToken",
                    "token（当前 OAuth credential）"
                  ],
                  "errors": [
                    "merge_request_not_found: mergeRequestId 不存在或请求方无权限感知该 execution record；为防枚举，source proof 校验失败也统一返回该错误或 404 → 客户端按授权失败处理，不据此判断 record 状态。",
                    "merge_confirm_expired: mergeConfirmToken 已过期且尚无 execution record → 重走 API-05 获取新的 mergeRequestId + mergeConfirmToken。",
                    "merge_source_invalid: source proof 无效或 sourceOneKeyIdAuthToken 不是 active OAuth OneKeyID → 重新校验登录态/重新 OAuth 登录。",
                    "oauth_credential_invalid: OAuth token 无效/过期/被撤销或与 source proof 不匹配 → 重新拉起 OAuth 获取当前 credential。",
                    "oauth_credential_mismatch: OAuth token 有效但解析出的 identity 与 API-05 确认页绑定的 canonical source 不一致（用户在确认页后切换了 OAuth credential）→ 丢弃当前 confirm 上下文，重新走 API-05 恢复，不能用旧确认页结果合并新 identity。",
                    "source_merge_in_progress: 同一 canonical source 已有未完成 processing relation → 提示已有任务未完成，不创建第二条执行记录。",
                    "account_merged_reauth_required: sourceOneKeyIdAuthToken 对应的 OAuth OneKeyID 已是 merged source → 清理本地 OneKeyID token / primePersistAtom，回登录页让用户手动重新 OAuth 登录（OAuth 登录会直接返回 target session），不能自动重试。",
                    "support_required: 历史数据无法自动判定，需客服/风控介入 → 展示客服入口。"
                  ],
                  "notes": [
                    "confirm 时切换了 OAuth credential → oauth_credential_mismatch，须重走 API-05。",
                    "canonical source lock key = sourceOneKeyUserId（merged_source 路径）；同一 source 同时只能有一个未完成合并任务。",
                    "mergeRequestId 仅作单次 confirm 重试幂等锚点，不是授权凭证、不能当 secret，也不能作为 source 旧 session 失效后的恢复登录路径。",
                    "执行期任何按 mergeRequestId 返回状态的请求必须先授权；授权失败统一返回 404 / not found，不暴露 record 是否存在或状态（防枚举）。",
                    "source 不迁移业务数据到 target；合并成功后 source 标记 merged archive 并保留 merge relation 供审计/客服。"
                  ]
                },
                "forkStyle": "list",
                "branches": [
                  {
                    "label": "merged",
                    "tone": "ok",
                    "nodes": [
                      {
                        "id": "s-done",
                        "type": "success",
                        "title": "完成：source 合并到 target",
                        "subtitle": "source 标记 merged archive，source active OAuth bindings retarget 到 target，source session 撤销。",
                        "detail": {
                          "returns": [
                            "status: merged",
                            "mergeExecution（source/target OneKeyUserId + mergedAt）",
                            "onekeySession（target）",
                            "onekeyAccount（target，含 legacy_email + 已 retarget 的 oauth identities）",
                            "oauthIdentityBinding.bindReason = merged_source_retarget"
                          ],
                          "notes": [
                            "oauthIdentityBinding 只描述本次 confirm 提交的 OAuth identity；其他被 retarget 的 OAuth identities 通过 onekeyAccount.identities 体现。",
                            "客户端刷新 primePersistAtom。流程结束。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "processing",
                    "tone": "warn",
                    "nodes": [
                      {
                        "id": "s-processing",
                        "type": "info",
                        "title": "处理中（Ex03 重试）",
                        "subtitle": "同 mergeRequestId 已创建 execution record 但主事务仍在执行中。",
                        "detail": {
                          "returns": [
                            "status: processing",
                            "sourceType: merged_source",
                            "retryAfterSeconds"
                          ],
                          "notes": [
                            "短时间后用同 mergeRequestId 重试，按授权 + mergeRequestId 幂等，不重复迁移/重复绑定。",
                            "processing 超时对账：四维度核对（mergeRequestId execution record 状态、source canonical lock、source OneKeyID status、source active OAuth bindings/email claim retarget 落库）后归一为三结果——已 merged 返回同一成功结果；未超时仍 processing 返回 processing + retryAfterSeconds；落库 failed / support_required 返回对应状态，不重复执行。",
                            "若客户端不确定 confirm 是否成功或 source session 已失效，应清理本地 token 并重新 OAuth 登录由当前 binding 归属返回 target session，而不是继续查询 mergeRequestId。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "failed",
                    "tone": "no",
                    "nodes": [
                      {
                        "id": "s-failed",
                        "type": "error",
                        "title": "failed",
                        "subtitle": "执行失败且已在主事务外/独立审计事务落库失败记录。",
                        "detail": {
                          "notes": [
                            "客户端不要自动重试。",
                            "失败记录独立于主合并事务，不因主事务回滚而丢失。"
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "label": "support_required",
                    "tone": "no",
                    "nodes": [
                      {
                        "id": "s-support",
                        "type": "error",
                        "title": "support_required",
                        "subtitle": "无法自动判定，需客服 / 风控介入。",
                        "detail": {
                          "notes": [
                            "展示客服入口，由客服按 merge relation / 审计记录核对。",
                            "若 source 旧 session 失效或返回 account_merged_reauth_required，清理本地 session，不要靠 mergeRequestId 找回登录态。"
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "label": "OTP 错误 / 过期",
            "tone": "no",
            "nodes": [
              {
                "id": "s-otp-error",
                "type": "error",
                "title": "merge_otp_invalid / merge_otp_expired",
                "subtitle": "OTP 不匹配或已过期；或 OAuth identity 已绑他账号且无法完成显式合并验证。",
                "detail": {
                  "errors": [
                    "merge_otp_invalid: OTP uuid/code 不匹配 → 重新输入或重发 OTP。",
                    "merge_otp_expired: OTP 或 otpPurposeToken 已过期 → 重发 OTP 或重走 API-04/API-05。",
                    "support_required: 验证链路无法自动判定（如 OAuth identity 已绑他账号、target 历史数据异常、无法完成显式合并验证）→ 升级客服。"
                  ],
                  "notes": [
                    "可重发 OTP 或重新走 API-05；另可能伴随 merge_source_invalid / merge_target_invalid / source_merge_in_progress。",
                    "若 OAuth identity 已绑定到另一个账号且无法通过本流程显式合并验证（非 OTP 问题），把链路接到客服升级，不在客户端反复重试。"
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
];
