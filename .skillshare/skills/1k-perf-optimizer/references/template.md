# Performance Optimization Session - [Date]

## Session Info
- **Start Time**: YYYY-MM-DD HH:MM:SS
- **Baseline Session**: [sessionId]
- **Baseline Metrics**:
  - tokensStartMs: XXXms
  - tokensSpanMs: XXXms
  - functionCallCount: XXX
- **Target**: [regression fix / performance improvement]
- **Branch**: [current branch name]

---

## Iteration 1

### Analysis
- **Session Data**: [sessionId1, sessionId2, sessionId3]
- **Median Metrics**:
  - tokensStartMs: XXXms
  - tokensSpanMs: XXXms
  - functionCallCount: XXX
- **Key Findings**:
  - [从 derive-session 分析出的瓶颈点]
  - [慢函数/jsblock/低FPS窗口的具体位置]
  - [重复调用/高频函数的模式]

### Code Changes
- **File**: path/to/file.ts
- **Location**: line XXX
- **Change Type**: [optimization / add perfMark / both]
- **Description**: [具体改动内容，包括改动前后的代码片段]
- **Rationale**: [为什么这样改，预期效果是什么]

### Verification Results
- **Session Data**: [sessionId4, sessionId5, sessionId6]
- **Median Metrics**:
  - tokensStartMs: XXXms (Δ vs prev: -X.X%, Δ vs baseline: -X.X%)
  - tokensSpanMs: XXXms (Δ vs prev: -X.X%, Δ vs baseline: -X.X%)
  - functionCallCount: XXX (Δ vs prev: -X.X%, Δ vs baseline: -X.X%)
- **Verdict**: ✅ SUCCESS / 🌟 MINOR_IMPROVEMENT / ❌ NO_IMPROVEMENT
- **Action**: [keep changes / create branch perf/xxx and revert / revert]
- **Notes**: [额外的观察或说明]

---

[Repeat "## Iteration N" sections for each iteration]

---

## Summary
- **Total Iterations**: X
- **Final Result**: [SUCCESS with X% improvement / Still investigating / etc.]
- **Effective Changes**:
  - [列出所有有效的改动]
- **Ineffective Changes**:
  - [列出被废弃的改动及原因]
- **Branches Created**:
  - [列出为 MINOR_IMPROVEMENT 创建的分支]
- **Next Steps**: [如果未完成，说明下一步计划]
