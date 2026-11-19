// Network fee subsidy records of the signed-in OneKey ID, served by Prime:
//   GET /prime/v1/subsidy/history  (last 90 days, newest first)
//   GET /prime/v1/subsidy/summary  (all-time totals)
//
// The contract lets the server add fields and enum values without a version
// bump, so every enum-like field is typed as `string`: an unknown value must
// be rendered as a generic fallback, never treated as an error.

export enum ESubsidyRecordKind {
  GaSponsorship = 'ga_sponsorship',
  TronEnergy = 'tron_energy',
}

export enum ESubsidyTronOperation {
  FreeClaim = 'free_claim',
  CodeRedeem = 'code_redeem',
}

export enum ESubsidyTronState {
  Dispatching = 'dispatching',
  SupplierAccepted = 'supplier_accepted',
  SupplierRejected = 'supplier_rejected',
  Unknown = 'unknown',
}

export enum ESubsidyGaAmountStatus {
  Evidenced = 'evidenced',
  Pending = 'pending',
  Unavailable = 'unavailable',
}

export enum ESubsidySourceStatus {
  Ok = 'ok',
  Unavailable = 'unavailable',
}

export type ISubsidyFeeAmount = {
  // Integer string in the smallest unit of the network's native token.
  value: string;
  unit: string;
};

export type ISubsidyUsdAmount = {
  // Decimal string; the platform's cost valuation, not what the user saved.
  value: string;
  basis: string;
};

type ISubsidyRecordBase = {
  id: string;
  kind: string;
  operation: string;
  networkId: string;
  address: string | null;
  createdAt: string;
  resolvedAt: string | null;
  state: string;
};

export type ISubsidyGaRecord = ISubsidyRecordBase & {
  kind: ESubsidyRecordKind.GaSponsorship;
  transaction: { hash: string; blockNumber: number | null } | null;
  ga: {
    settlementStage: string | null;
    amountStatus: string;
    userTxFee: ISubsidyFeeAmount | null;
    fundingTxFee: ISubsidyFeeAmount | null;
    // null means "no evidenced amount"; it must never be displayed as 0.
    sponsorCostUsd: ISubsidyUsdAmount | null;
    netSubsidy: null;
    // Gas Account scenario of the sponsored transaction. Agreed with the
    // backend but not returned yet; absent on every record until it ships.
    scenario?: string;
  };
};

// An issuance attempt, not a delivery record: `supplier_accepted` only means
// the supplier took the request. It carries no amount or energy quantity.
export type ISubsidyTronRecord = ISubsidyRecordBase & {
  kind: ESubsidyRecordKind.TronEnergy;
  transaction: null;
};

export type ISubsidyRecord = ISubsidyGaRecord | ISubsidyTronRecord;

export type ISubsidyHistory = {
  contractVersion: number;
  subjectScope: string;
  items: ISubsidyRecord[];
  nextCursor: string | null;
  // false when a source failed: the list is partial, not empty.
  complete: boolean;
  sources: { kind: string; status: string }[];
  // Records in the 90-day window that match the query's filter. Sent with the
  // first page only: later pages omit it and the first page's value stands.
  // 0 means no records; null means the count is temporarily unavailable.
  total?: number | null;
};

export type ISubsidyHistoryParams = {
  kind?: ESubsidyRecordKind;
  networkId?: string;
  address?: string;
  // 1-50, server default 20.
  limit?: number;
  // Two ways to move through the list, never both in one request (the server
  // answers 90001): `page` (1-based) jumps to any page, `cursor` continues
  // from the `nextCursor` of the previous response.
  page?: number;
  cursor?: string;
};

export type ISubsidySummary = {
  contractVersion: number;
  subjectScope: string;
  asOf: string;
  // `ga` / `tron` are present only for the kinds the query selected; both are
  // returned when `kind` is omitted.
  ga?: {
    operations: number;
    // Records in the `settled` state.
    sponsoredCount: number;
    evidencedOperations: number;
    feeTotals: {
      networkId: string;
      userTxFee: ISubsidyFeeAmount;
      fundingTxFee: ISubsidyFeeAmount | null;
      operations: number;
    }[];
    // Covers `coveredCount` settled records only, which can be fewer than
    // `sponsoredCount`.
    sponsorCostUsd: (ISubsidyUsdAmount & { coveredCount: number }) | null;
  };
  tron?: {
    attempts: number;
    byState: Partial<Record<ESubsidyTronState, number>>;
  };
};
