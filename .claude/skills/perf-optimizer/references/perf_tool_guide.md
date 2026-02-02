# Performance Monitoring Tool Guide

## Overview

The performance monitoring tooling consists of:
- `development/performance-server/`: WebSocket server + Dashboard + Analysis libraries
- `packages/shared/src/performance/collectors/`: Performance data collectors
- Session data storage: `~/perf-sessions/` (default)

## Key Command: derive-session

Generate analysis report from a session ID:

```bash
node development/performance-server/cli/derive-session.js <sessionId> \
  --pretty \
  --output /tmp/perf-<sessionId>.json
```

### Common Options

- `--topSlow 50`: Number of slowFunctions to output (default: 50)
- `--topRepeated 50`: Number of repeatedCalls to output (default: 50)
- `--fpsThreshold 10`: Low FPS threshold (<10 = stuttering window), use `--noFps` to disable
- `--fpsTopWindows 10`: Output top N worst FPS windows (default: 10)
- `--fpsTopFunctions 25`: Top N hot functions per FPS window (default: 25)
- `--noJsblock`: Disable jsblock window analysis

## Output Structure

The derived JSON contains:

### lowFps
FPS windows below threshold with:
- `topWindows`: Worst performing time windows
- Hot functions in each window (by total time/call count)

### jsblock
Main thread blocking events:
- `topWindows`: jsblock:main windows (JS thread stalls)
- Hot functions causing the blocks

### keyMarks
Critical milestone marks:
- `Home:refresh:start:tokens` / `Home:refresh:done:tokens`
- `Home:done:tokens`
- `AllNet:*` phase marks (for explaining delays/jsblock)
- `Bootstrap:*` / `Home:defi:*` marks (for staggering verification)

### homeRefreshTokens
Analysis of the `Home:refresh:start:tokens → Home:refresh:done:tokens` window:
- Top functions + bgcall/storage/simpledb/jsblock marks
- Directly answers "what's consuming time in refresh span"

### slowFunctions
Session-wide aggregated slow function list:
- Functions sorted by total execution time
- Call counts and average duration

### repeatedCalls
High-frequency repeated calls in short time windows:
- Used to locate "thrashing/re-renders/loop triggers"
- Indicates potential optimization opportunities

### repeatedCallsOverall
Overall call count ranking:
- Most frequently called functions across entire session
- Helps identify hot paths

## Session Data Location

Default: `~/perf-sessions/<sessionId>/`

Each session directory contains:
- `mark.log`: Performance marks (JSONL format)
- `function_call.log`: Function call traces (JSONL format)
- Other collector logs

## Reading sessions.overview.jsonl

To list all available sessions:

```bash
cat ~/perf-sessions/sessions.overview.jsonl | jq -r '[.sessionId, .createdAt, .marks["Home:refresh:done:tokens"]] | @tsv'
```

Each line is a JSON object with session metadata and key marks.
