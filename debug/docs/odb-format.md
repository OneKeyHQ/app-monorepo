# .odb Trace Format

`.odb` is a **directory** (not a single file) containing a captured
debugging session timeline. It is designed to be inspected by humans and
machines, streamable while being written, and replayable on a different
session.

## Layout

```
trace-<id>.odb/
├── manifest.json          # session metadata, layer set, event count
├── events.ndjson          # one JSON event per line, ordered by ts
└── media/                 # ui snapshots + screenshots referenced by events
    ├── S-<id>-<ts>.png
    └── S-<id>-<ts>.tree.json
```

## manifest.json

```json
{
  "version": 1,
  "recordId": "R-…",
  "sessionId": "S-…",
  "platform": "ios|android",
  "appBundle": "com.onekey.wallet",
  "layers": ["js", "network", "native", "ui"],
  "startedAt": 1779200000000,
  "endedAt": 1779200030000,
  "eventCount": 412,
  "compression": "none"
}
```

`compression: "zstd"` is reserved for V2; the current writer always emits
plain NDJSON. We avoid adding a Node zstd dep for MVP.

## Event schema

All events have `ts` (unix ms), `layer`, and `kind`. Layer-specific fields:

| Layer     | Kinds                            | Notable fields                                          |
| --------- | -------------------------------- | ------------------------------------------------------- |
| `js`      | `console`, `eval`                | `type`, `args` ; `expression`, `result`, `error`        |
| `network` | `request`, `response`, `failure` | `requestId`, `url`, `method`, `status`, `errorText`     |
| `native`  | `enter`, `leave`, `log`          | `hookId`, `method`, `retval`                            |
| `ui`      | `snapshot`                       | `mediaPath` (relative to the .odb root)                 |

## Streaming

`events.ndjson` is append-only. Writers append one line per event;
readers can `tail -f` the file or read chunks as they arrive. The
manifest is rewritten on `record.stop` to reflect the final `endedAt`
and `eventCount`.

## Replay semantics

- `js.eval` events can be re-executed on a *target* session via `replay`.
- `native` events are dry-run only — replaying them on a live device
  could mutate real state.
- `network` events are read-only timeline markers; replay does not
  re-issue HTTP requests.
- `ui` snapshots are pure observation; replay just acknowledges them.

## Tool surface

| RPC             | Notes                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| `record.start`  | `{sessionId, layers?, uiIntervalMs?}` → `{recordId, path}`                              |
| `record.stop`   | `{sessionId}` → `{path, eventCount, durationMs}`                                        |
| `record.status` | `{sessionId}` → `{recording: boolean}`                                                  |
| `replay`        | `{path, targetSessionId?, layers?, speed?}` → `{replayed, skipped, errors}`             |
| `timeline`      | `{path, t, windowMs?}` → `{manifest, events}` (events within ±windowMs/2 of `startedAt + t`) |
