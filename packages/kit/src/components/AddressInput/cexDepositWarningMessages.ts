import type { IntlShape, MessageDescriptor } from 'react-intl';

export const cexDepositWarningMessages = {
  assetTitle: {
    id: 'cex_deposit_unsupported_asset__title',
    defaultMessage: '{exchange} may not accept {token} on {network}',
  },
  assetTitleWithoutExchange: {
    id: 'cex_deposit_unsupported_asset_unknown_exchange__title',
    defaultMessage: 'This exchange may not accept {token} on {network}',
  },
  title: {
    id: 'cex_deposit_unsupported__title',
    defaultMessage: '{exchange} may not accept this deposit',
  },
  titleWithoutExchange: {
    id: 'cex_deposit_unsupported_unknown_exchange__title',
    defaultMessage: 'This exchange may not accept this deposit',
  },
  inlineDescription: {
    id: 'cex_deposit_check_supported_networks__desc',
    defaultMessage:
      'Check supported networks for your asset on the exchange’s deposit page.',
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
