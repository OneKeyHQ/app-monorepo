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
      'Check supported networks for your asset on the exchange’s deposit page.',
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
      'Check supported networks for your asset on the exchange’s deposit page. If you send anyway, your funds could be lost.',
  },
};

export function formatCexDepositWarningMessage(
  intl: IntlShape,
  message: { id: string; defaultMessage: string },
  values: Record<string, string | undefined>,
): string {
  return intl.formatMessage(message as unknown as MessageDescriptor, values);
}
