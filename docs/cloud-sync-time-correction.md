# CloudSync Time Correction

CloudSync conflict resolution depends on `dataTimestamp`. Client system time can be wrong, so the timestamp used for SyncItems must be corrected before upload. The client is the only timestamp source for normal writes; the server should not stamp writes with its own time, but it must repair already-poisoned future timestamps stored in the server database.

## Server Responsibilities

1. Validate incoming timestamps before writing.
   - If `dataTimestamp` is missing or invalid, use `serverNow`.
   - If `dataTimestamp` is greater than `serverNow + tolerance`, clamp it to `serverNow`.
   - `tolerance` should match the client trust window, currently 10 minutes.

2. Detect existing future-poisoned server records.
   - Before normal last-write-wins comparison, check the current server record for the same key.
   - If the existing record timestamp is greater than `serverNow + tolerance`, treat it as poisoned.
   - For poisoned records, accept the corrected incoming item directly and replace the poisoned timestamp instead of rejecting the incoming item as older.

3. Keep normal LWW for healthy records.
   - If no existing record exists, create it with the normalized incoming timestamp.
   - If an existing record is not poisoned, only overwrite when `incomingTimestamp >= existingTimestamp`.
   - Deletion tombstones must use the same rules as normal records.

4. Record repair diagnostics.
   - Log key, data type, old timestamp, new timestamp, serverNow, and repair reason.
   - These logs are needed to audit poisoned timestamp recovery.

Pseudo-code:

```ts
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

function normalizeIncomingTimestamp(incomingTimestamp, serverNow) {
  if (!isValidTimestamp(incomingTimestamp)) {
    return serverNow;
  }
  if (incomingTimestamp > serverNow + FUTURE_TOLERANCE_MS) {
    return serverNow;
  }
  return incomingTimestamp;
}

function shouldOverwrite({ existing, incoming, serverNow }) {
  const incomingTimestamp = normalizeIncomingTimestamp(
    incoming.dataTimestamp,
    serverNow,
  );

  if (!existing) {
    return { overwrite: true, dataTimestamp: incomingTimestamp };
  }

  const existingFuturePoisoned =
    existing.dataTimestamp > serverNow + FUTURE_TOLERANCE_MS;

  if (existingFuturePoisoned) {
    return {
      overwrite: true,
      dataTimestamp: incomingTimestamp,
      reason: 'repair-existing-future-timestamp',
    };
  }

  return {
    overwrite: incomingTimestamp >= existing.dataTimestamp,
    dataTimestamp: incomingTimestamp,
  };
}
```

## Client Responsibilities

1. Maintain a corrected CloudSync time source.
   - Store the latest valid server time from OneKey response `Date` headers and CloudSync `/sync/check` `serverTime`.
   - Store a monotonic baseline using `performance.now()` when that server time is recorded.
   - Estimate current server time as `lastServerTime + (performance.now() - perfBase)`.
   - Existing OneKey-domain responses and the 5-minute health check continue to refresh the baseline.

2. Use corrected time for all normal SyncItem writes.
   - Normal create/update/delete SyncItems use `getCloudSyncDataTime()`.
   - Do not use raw `Date.now()` for SyncItem `dataTime` unless local time is currently verified as valid and no server estimate exists.
   - Do not use `useServerDataTime`; the server will not stamp normal writes.

3. Preserve explicit historical times only when requested.
   - Restore/genesis flows may explicitly request historical time.
   - Historical time must not be greater than corrected now.
   - Normal writes must not pass business-layer `Date.now()` as authoritative.

4. Keep per-key monotonic protection in memory.
   - Track the last issued timestamp by SyncItem key only while the process is alive.
   - If a new timestamp for the same key would not move forward, issue `lastIssued + 1`.
   - Do not globally sequence unrelated keys.
   - Do not persist the in-memory map; existing DB item timestamps provide restart protection.

5. Repair local future-poisoned CloudSync items.
   - If the local CloudSync pool has a timestamp greater than corrected now plus tolerance, allow a corrected incoming item to overwrite it even though the incoming timestamp is lower.
   - This prevents old local future timestamps from blocking new corrected writes.
   - `/sync/check` future clamping remains as a final local safety net.

6. Use corrected time for Keyless signature headers.
   - The Keyless signature header timestamp is authentication time, not SyncItem `dataTime`.
   - Generate it from corrected now, not raw `Date.now()`.
   - Do not use `getCloudSyncDataTime()` for this header because that method has SyncItem-specific per-key monotonic behavior.
   - If corrected now is not based on an estimated server time or trusted local time, refresh server time once before signing.

Pseudo-code:

```ts
function getCorrectedCloudSyncNow() {
  const estimated = getEstimatedServerTime();
  if (estimated) {
    return { time: estimated, source: 'estimated' };
  }

  const localNow = Date.now();
  if (systemTimeStatus === 'VALID' && isLocalTimeValid(localNow)) {
    return {
      time: Math.max(localNow, lastServerTime, appBuildTime),
      source: 'trusted-local',
    };
  }

  if (lastServerTime) {
    return { time: lastServerTime, source: 'last-server' };
  }

  return { time: appBuildTime, source: 'app-build' };
}

function issueCloudSyncDataTime({ key, existingDataTime }) {
  const correctedNow = getCorrectedCloudSyncNow();
  let dataTime = correctedNow.time;

  const existingFuturePoisoned =
    correctedNow.source !== 'app-build' &&
    existingDataTime > correctedNow.time + FUTURE_TOLERANCE_MS;

  const monotonicFloor = Math.max(
    existingFuturePoisoned ? 0 : existingDataTime ?? 0,
    lastIssuedByKey.get(key) ?? 0,
  );

  if (dataTime <= monotonicFloor) {
    dataTime = monotonicFloor + 1;
  }

  lastIssuedByKey.set(key, dataTime);
  return dataTime;
}
```
