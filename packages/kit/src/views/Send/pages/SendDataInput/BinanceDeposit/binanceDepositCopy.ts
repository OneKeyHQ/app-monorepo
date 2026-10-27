// Final product copy that has no translation key yet, English only. Strings
// with an existing key (Recipient, Cancel, Clear, Tag, Try again, Open
// Binance, the minimum amount) already go through ETranslations.
export const BINANCE_DEPOSIT_COPY = {
  accountName: 'My Binance account',
  // What the deposit address takes: this coin, sent over this network.
  assetOnNetwork: (symbol: string, network: string) =>
    `${symbol} on ${network}`,
  opening: 'Opening Binance…',
  openingDesc: 'You’ll come back here automatically.',
  confirmTitle: 'Confirm in the Binance app',
  confirmDesc: 'Didn’t see it in Binance? Open it again.',
  gettingAddress: 'Getting your deposit address…',
  confirmedTitle: 'Confirmed in Binance',
  confirmedDesc:
    'Didn’t come back here automatically? You can start again in up to 10 minutes.',
  connectFailed: 'Couldn’t connect to Binance',
  addressFailed: 'Couldn’t get your deposit address',
  securityFailedTitle: 'Security check failed',
  enterAddress: 'Enter address instead',
  toastUnavailable: 'Couldn’t connect to Binance. Try again later.',
  toastAssetUnavailable: 'This asset can’t be deposited to Binance right now.',
  toastRateLimited: 'Too many requests. Try again later.',
  verifyFailedTitle: 'Couldn’t verify the deposit address. Nothing was sent.',
  verifyFailedDesc: 'Go back and get the address again.',
  verifyUnavailableTitle: 'Couldn’t verify the address.',
  verifyUnavailableDesc: 'Check your connection and confirm again.',
  destinationInvalidTitle:
    'This deposit address is no longer valid. Nothing was sent.',
  destinationInvalidDesc: 'Go back and get a new one.',
};
