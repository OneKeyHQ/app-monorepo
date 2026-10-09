import { useIntl } from 'react-intl';

import { Popover, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { TokenList } from './TokenList';

import type { IToken } from '../../types';

export interface ITokenSelectorPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: IToken[];
  onTokenPress: (token: IToken) => void;
  disabledOnSwitchToTrade?: boolean;
  onTradePress?: () => void;
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
  isTokenDisabled?: (token: IToken) => boolean;
  sortTokensByValue?: boolean;
}

export function TokenSelectorPopover({
  isOpen,
  onOpenChange,
  tokens,
  onTokenPress,
  disabledOnSwitchToTrade,
  onTradePress,
  currentSelectToken,
  disableNativeToken,
  isTokenDisabled,
  sortTokensByValue,
}: ITokenSelectorPopoverProps) {
  const intl = useIntl();
  return (
    <Popover
      floatingPanelProps={{
        width: 288,
      }}
      title={intl.formatMessage({ id: ETranslations.dexmarket_select_token })}
      open={isOpen}
      onOpenChange={onOpenChange}
      renderContent={
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.swap,
            sceneUrl: '',
          }}
          e2eContextProbeName="market-swap-token-popover"
          enabledNum={[0]}
        >
          <TokenList
            currentSelectToken={currentSelectToken}
            onTradePress={() => {
              onOpenChange(false);
              onTradePress?.();
            }}
            tokens={tokens}
            onTokenPress={onTokenPress}
            disabledOnSwitchToTrade={disabledOnSwitchToTrade}
            disableNativeToken={disableNativeToken}
            isTokenDisabled={isTokenDisabled}
            sortTokensByValue={sortTokensByValue}
          />
        </AccountSelectorProviderMirror>
      }
      renderTrigger={<Stack />}
    />
  );
}
