import { useIntl } from 'react-intl';

import { withBrowserProvider } from '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ActionBase } from './ActionBase';

import type { IActionProps } from './type';

const ActionSell = ({
  networkId,
  tokenAddress,
  accountId,
  walletType,
  ...rest
}: IActionProps) => {
  const intl = useIntl();
  return (
    <ActionBase
      networkId={networkId}
      tokenAddress={tokenAddress}
      accountId={accountId}
      label={intl.formatMessage({ id: ETranslations.global_cash_out })}
      icon="MinusLargeOutline"
      type="sell"
      walletType={walletType}
      {...rest}
    />
  );
};

export default withBrowserProvider<IActionProps>(ActionSell);
