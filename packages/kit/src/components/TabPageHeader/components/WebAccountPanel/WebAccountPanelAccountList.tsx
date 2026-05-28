import { useCallback } from 'react';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAccountSelectorTrigger } from '../../../AccountSelector/hooks/useAccountSelectorTrigger';

import { WebAccountPanelListItem } from './atoms/WebAccountPanelListItem';

// TODO(i18n): once Lokalise has `settings.add_external_wallet`, replace this.
const addExternalWalletLabel = 'Add external wallet';

export interface IWebAccountPanelAccountListProps {
  onRequestClose: () => void;
}

export function WebAccountPanelAccountList({
  onRequestClose,
}: IWebAccountPanelAccountListProps) {
  const {
    activeAccount: { account, dbAccount, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });

  const address = account?.address
    ? accountUtils.shortenAddress({ address: account.address })
    : '';

  const handleAddExternal = useCallback(() => {
    onRequestClose();
    setTimeout(() => {
      showAccountSelector();
    }, 150);
  }, [onRequestClose, showAccountSelector]);

  return (
    <YStack py="$5" w="100%">
      <WebAccountPanelListItem
        testID="web-account-panel-account-list-current"
        renderLeft={
          <XStack ai="center" gap="$2" w="100%">
            <AccountAvatar
              size="$5"
              borderRadius="$full"
              account={account}
              dbAccount={dbAccount}
              indexedAccount={indexedAccount}
            />
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {address}
            </SizableText>
          </XStack>
        }
        renderRight={<Icon name="CheckRadioSolid" size="$5.5" color="$icon" />}
      />
      {/*
        TODO: render other selectable accounts once the data source for "all
        connected accounts in web dapp mode" is confirmed with the product team.
        Today we only show the active account + the entry to add another.
      */}
      <Stack pt="$3" px="$5" w="100%">
        <Button
          variant="secondary"
          icon="PlusLargeOutline"
          onPress={handleAddExternal}
          testID="web-account-panel-add-external"
        >
          {addExternalWalletLabel}
        </Button>
      </Stack>
    </YStack>
  );
}
