export interface IndexerUrlMapping {
  rpcUrl: string;
  indexerUrl: string;
}

export interface NervosImplOptions {
  indexer: IndexerUrlMapping[];
}
