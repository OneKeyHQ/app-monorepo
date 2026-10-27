// The single enum that drives the pluggable buy action zone (S1–S5 in the UX spec).
export enum EBuyActionState {
  Preparing = 'preparing', // S1: session initializing / first quote loading
  InvalidAmount = 'invalidAmount', // disabled, waiting for a valid amount
  Ready = 'ready', // S2: native (or mock) button ready
  Refreshing = 'refreshing', // S3: re-quoting, old button under a loading mask
  RetryableError = 'retryableError', // S4: inline error + retry
  WebFallback = 'webFallback', // S5: structural failure → web widget
}
