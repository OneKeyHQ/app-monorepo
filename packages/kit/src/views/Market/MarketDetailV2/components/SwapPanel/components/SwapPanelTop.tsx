import { useIntl } from 'react-intl';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BalanceDisplay } from './BalanceDisplay';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

interface ISwapPanelTopProps {
  balance: BigNumber;
  balanceToken?: IToken;
  balanceLoading: boolean;
  handleBalanceClick: () => void;
}

const SwapPanelTop = ({
  balance,
  balanceToken,
  balanceLoading,
  handleBalanceClick,
}: ISwapPanelTopProps) => {
  const intl = useIntl();
  return (
    <YStack>
      <XStack justifyContent="space-between">
        <XStack borderBottomWidth="$0.5" borderBottomColor="$borderActive">
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({ id: ETranslations.perp_trade_market })}
          </SizableText>
        </XStack>
        <BalanceDisplay
          balance={balance}
          token={balanceToken}
          isLoading={balanceLoading}
          onBalanceClick={handleBalanceClick}
          useIcon
        />
      </XStack>
      <Divider />
    </YStack>
  );
};

export default SwapPanelTop;
