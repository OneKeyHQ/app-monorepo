/**
 * Freshness metadata attached to a persisted wallet asset snapshot.
 *
 * `serverDateMs` is the validated HTTP Date header observed for the response
 * that produced the snapshot. It is a best-effort source marker, not a server
 * data version. `localSeq` records request/refresh order and is the primary
 * ordering key; the server marker is used only when sequences are equal.
 */
export interface IAssetSnapshotMeta {
  serverDateMs?: number;
  localSeq: number;
}
