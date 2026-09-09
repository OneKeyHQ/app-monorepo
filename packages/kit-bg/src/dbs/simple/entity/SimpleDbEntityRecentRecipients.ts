export interface IRecentRecipientData {
  updatedAt: number;
  networkId?: string; // The network where the last transfer occurred
  memo?: string; // Blockchain memo (Cosmos, XRP destination tag, etc.)
}

export interface IRecentRecipientsDBStruct {
  recentRecipients: Record<string, Record<string, IRecentRecipientData>>; // { storageKey: { recipient address: { updatedAt, networkId } } }
}

export interface IRecentRecipientEntry {
  address: string;
  updatedAt: number;
  networkId?: string;
  memo?: string;
}

// Per-bucket storage cap. Callers fanning out across buckets should request
// up to this many entries so the merge step has the full pool to dedupe from.
export const RECENT_RECIPIENTS_BUCKET_CAP = 10;
