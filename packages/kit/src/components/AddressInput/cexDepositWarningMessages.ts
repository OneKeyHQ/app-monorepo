import type { IntlShape, MessageDescriptor } from 'react-intl';

export const cexDepositWarningMessages = {
  inlineTitle: {
    id: 'cex_deposit_inline__title',
    defaultMessage: '{exchange} may not accept {token} on {network}',
  },
  inlineTitleWithoutExchange: {
    id: 'cex_deposit_inline_unknown_exchange__title',
    defaultMessage: 'This exchange may not accept {token} on {network}',
  },
  inlineTitleWithoutAssetOrNetwork: {
    id: 'cex_deposit_inline_generic__title',
    defaultMessage: '{exchange} may not accept this deposit',
  },
  inlineTitleWithoutDetails: {
    id: 'cex_deposit_inline_unknown_details__title',
    defaultMessage: 'This exchange may not accept this deposit',
  },
  inlineDescription: {
    id: 'cex_deposit_inline__desc',
    defaultMessage:
      "Check {exchange}'s supported deposit networks before sending.",
  },
  inlineDescriptionWithoutExchange: {
    id: 'cex_deposit_inline_unknown_exchange__desc',
    defaultMessage:
      "Check the exchange's supported deposit networks before sending.",
  },
  dialogTitle: {
    id: 'cex_deposit_unsupported__title',
    defaultMessage: '{exchange} may not accept this deposit',
  },
  dialogTitleWithoutExchange: {
    id: 'cex_deposit_unsupported_unknown_exchange__title',
    defaultMessage: 'This exchange may not accept this deposit',
  },
  dialogDescription: {
    id: 'cex_deposit_unsupported__desc',
    defaultMessage:
      "{token} deposits on {network} may be unavailable at {exchange}. Check {exchange}'s deposit page first. If you send anyway, your funds could be lost.",
  },
  dialogDescriptionWithoutDetails: {
    id: 'cex_deposit_unsupported_unknown_details__desc',
    defaultMessage:
      "This deposit may be unavailable at the exchange. Check the exchange's deposit page first. If you send anyway, your funds could be lost.",
  },
};

export function formatCexDepositWarningMessage(
  intl: IntlShape,
  message: { id: string; defaultMessage: string },
  values: Record<string, string | undefined>,
): string {
  return intl.formatMessage(message as unknown as MessageDescriptor, values);
}
