/**
 * 共享内容数据：同一条真实业务链路，供多种「形式」HTML 渲染对比。
 * 场景：pending_oauth_bind 显式确认合并
 * 节点 type: api(接口调用) | user(用户操作) | success(成功终态) | error(错误终态)
 */
window.FLOW = {
  title: "pending_oauth_bind 显式确认合并",
  scenario:
    "用户已进入 pending_oauth_bind 状态，显式确认把当前 OAuth identity 绑定/合并到目标 legacy OneKeyID。",

  // 分叉前的主链路
  main: [
    {
      id: "prepare",
      type: "api",
      title: "Prepare：签发 OTP purpose",
      subtitle: "客户端进入 pending_oauth_bind，请求一次 OTP purpose。",
      detail: {
        params: ["oauthAccessToken", "purpose = bind_oauth"],
        returns: ["mergeRequestId", "otpPurposeToken"],
        notes: ["此处只签发 purpose，尚未发送 OTP。"],
      },
    },
    {
      id: "send-otp",
      type: "api",
      title: "Send OTP：发送 target legacy Email OTP",
      subtitle: "向待合并的 legacy email 发送验证码。",
      detail: {
        params: ["otpPurposeToken", "targetLegacyEmail"],
        returns: ["otpSent: true", "resendAfter"],
        notes: ["同一 mergeRequestId 下允许有限次重发。"],
      },
    },
  ],

  // 分叉节点（决策点）
  fork: {
    node: {
      id: "verify",
      type: "api",
      title: "Verify Target：验证 legacy Email OTP",
      subtitle: "校验用户输入的 OTP 是否匹配 target legacy email。",
      decision: "验证通过？",
      detail: {
        params: ["otpPurposeToken", "otpCode"],
        returns: ["verified: true | false"],
        notes: ["验证通过才允许进入二次确认。"],
      },
    },
    branches: [
      {
        key: "yes",
        label: "是 · 验证通过",
        tone: "ok",
        nodes: [
          {
            id: "confirm-page",
            type: "user",
            title: "确认页：用户二次确认",
            subtitle: "展示将把当前 OAuth identity 绑定到哪个 legacy OneKeyID，用户确认。",
            detail: {
              notes: ["纯前端确认步骤，防止误合并。", "用户取消则退出 pending 状态。"],
            },
          },
          {
            id: "confirm",
            type: "api",
            title: "Confirm：最终绑定 OAuth identity",
            subtitle: "服务端把 OAuth identity 绑定到 target legacy OneKeyID。",
            detail: {
              params: ["mergeRequestId", "otpPurposeToken"],
              returns: ["status: success", "onekeySession"],
              notes: ["幂等：同 mergeRequestId 重复 Confirm 返回同一结果。"],
            },
          },
          {
            id: "done",
            type: "success",
            title: "完成：绑定到 target legacy OneKeyID",
            subtitle: "返回 active session，客户端刷新 primePersistAtom。",
            detail: {
              returns: ["bindReason = pending_oauth_bind_confirmed"],
              notes: ["流程结束。"],
            },
          },
        ],
      },
      {
        key: "no",
        label: "否 · 验证失败 / 过期",
        tone: "no",
        nodes: [
          {
            id: "otp-error",
            type: "error",
            title: "OTP 错误或过期",
            subtitle: "返回错误码，允许在 resendAfter 后重发或退出。",
            detail: {
              returns: ["code: otp_invalid | otp_expired"],
              notes: ["不销毁 mergeRequestId，可重试。"],
            },
          },
        ],
      },
    ],
  },
};

// 通用样式映射
window.FLOW_META = {
  colors: { api: "#2563eb", user: "#7c3aed", success: "#16a34a", error: "#dc2626" },
  tags: { api: "接口调用", user: "用户操作", success: "成功", error: "错误" },
};
