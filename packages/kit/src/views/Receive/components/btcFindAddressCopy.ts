import { BTC_FIND_ADDRESS_MAX_INDEX } from '@onekeyhq/shared/src/consts/chainConsts';

// TODO(i18n): OK-55653 copy is pending Lokalise keys and final UX naming,
// keep all temporary strings here so the swap is a one-file change.
// kept free of component imports so non-Receive pages (e.g. CoinControl)
// can use the labels without pulling in the dialog component module
export const findAddressCopy = {
  entryLabel: 'Find address',
  dialogTitle: 'Find address',
  warningTitle: 'Remember your path settings',
  warningDesc:
    'To recover funds on a custom-index address you must remember its settings (address type + account + index), otherwise the assets cannot be found again.',
  accountLabel: 'Account',
  addressTypeLabel: 'Address type',
  indexLabel: 'Address index',
  pathPreviewLabel: 'Full path',
  confirmText: 'Find',
  invalidIndex: `Enter an integer between 0 and ${BTC_FIND_ADDRESS_MAX_INDEX}`,
  alreadyDiscovered:
    'This address is already in your account, no need to recover it manually.',
  addedToast: 'Added',
  sectionTitle: 'Manually recovered',
  sectionDesc:
    'Funds on these addresses can only be spent by selecting them in Coin Control when sending.',
  removeConfirmTitle: 'Remove this address?',
  removeConfirmDesc:
    'After removal the address is hidden again. To use it later, find it again by its index.',
  indexBadge: (index: number) => `#${index}`,
  claimedUtxoLabel: 'Manually recovered',
};
