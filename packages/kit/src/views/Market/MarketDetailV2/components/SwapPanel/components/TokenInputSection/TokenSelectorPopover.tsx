import { useIntl } from 'react-intl';

import { Popover, Stack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TokenList } from './TokenList';

import type { IToken } from '../../types';

export interface ITokenSelectorPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: IToken[];
  onTokenPress: (token: IToken) => void;
}

export function TokenSelectorPopover({
  isOpen,
  onOpenChange,
  tokens,
  onTokenPress,
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
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
          enabledNum={[0]}
        >
          <TokenList
            onTradePress={() => {
              onOpenChange(false);
            }}
            tokens={tokens}
            onTokenPress={onTokenPress}
          />
        </AccountSelectorProviderMirror>
      }
      renderTrigger={<Stack />}
    />
  );
}
