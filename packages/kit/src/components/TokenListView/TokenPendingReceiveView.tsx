import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenPendingReceiveSats } from './useTokenFiatField';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

// Lightning on Spark: sats paid to the account while its wallet was offline,
// which the balance leaves out until the wallet claims them. The token details
// page claims them.
function TokenPendingReceiveView(props: IProps) {
  const { $key, symbol, hideValue, ...rest } = props;
  const intl = useIntl();
  const pendingReceiveSats = useTokenPendingReceiveSats($key);

  if (!pendingReceiveSats || new BigNumber(pendingReceiveSats).lte(0)) {
    return null;
  }

  return (
    <XStack gap="$1" justifyContent="flex-end">
      <SizableText color="$textSuccess" {...rest}>
        {intl.formatMessage({ id: ETranslations.earn_claimable })}
      </SizableText>
      <NumberSizeableTextWrapper
        hideValue={hideValue}
        formatter="balance"
        formatterOptions={{ tokenSymbol: symbol }}
        color="$textSuccess"
        {...rest}
      >
        {pendingReceiveSats}
      </NumberSizeableTextWrapper>
    </XStack>
  );
}

export default memo(TokenPendingReceiveView);
