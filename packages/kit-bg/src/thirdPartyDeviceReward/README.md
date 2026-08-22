# Third-party device reward

本目录只保留交接资料，运行时代码按职责拆分：

- `ServiceThirdPartyDeviceReward`：challenge/claim API、完整业务编排和开发态 mock
- `ServiceThirdPartyHardware`：background 中的 JSSDK/设备通信，不决定是否发券
- `ThirdPartyDeviceRewardDialog`：触发 Reward Service 并展示结果
- 后端会议上下文与讲解顺序：`BACKEND-MEETING-WALKTHROUGH.md`
- 后台 API、验真规则与验收标准：`BACKEND-API-HANDOFF.md`

不保留额外 client 转发层，也不把领券接口放进 Referral Service。
