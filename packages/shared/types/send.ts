export enum ESendPreCheckTimingEnum {
  BeforeTransaction = 'BeforeTransaction',
  Confirm = 'Confirm',
}

// BTC Coin Control - UTXO selection strategy
export enum EUtxoSelectionStrategy {
  // Default: coin selector algorithm decides which UTXOs to use
  Default = 'default',
  // ForceSelected: all selected UTXOs must be used (required: true)
  ForceSelected = 'forceSelected',
}
