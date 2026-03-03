import { useIntl } from 'react-intl';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BalanceDisplay } from './BalanceDisplay';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

interface ISwapPanelTopProps {
  balance: BigNumber;
  enableAddressTypeSelector: boolean;
  activeAccount: IAccountSelectorActiveAccountInfo;
  balanceToken?: IToken;
  balanceLoading: boolean;
  handleBalanceClick: () => void;
}

const SwapPanelTop = ({
  balance,
  enableAddressTypeSelector = false,
  balanceToken,
  balanceLoading,
  activeAccount,
  handleBalanceClick,
}: ISwapPanelTopProps) => {
  const intl = useIntl();
  return (
    <YStack>
      <XStack justifyContent="space-between">
        <XStack
          borderBottomWidth="$0.5"
          borderBottomColor="$borderActive"
          ml={2}
        >
          <SizableText size="$bodyMdMedium" cursor="default">
            {intl.formatMessage({ id: ETranslations.perp_trade_market })}
          </SizableText>
        </XStack>
        <BalanceDisplay
          activeAccount={activeAccount}
          balance={balance}
          enableAddressTypeSelector={enableAddressTypeSelector}
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
