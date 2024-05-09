import { useCallback } from 'react';

import {
  Divider,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletListView } from '@onekeyhq/kit/src/components/WalletListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const ListFooterComponent = () => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.push(EModalKeyTagRoutes.BackupRecoveryPhrase);
  }, [navigation]);
  return (
    <YStack>
      <SizableText size="$bodySm" color="$textSubdued" px="$5" mt="$5">
        Hardware wallets do not currently support backup to KeyTag, only App
        wallets will appear here.
      </SizableText>
      <XStack px="$5" pt="$5" pb="$4">
        <Divider />
      </XStack>
      <ListItem
        icon="PencilOutline"
        title="Enter Recovery Phrase"
        drillIn
        onPress={onPress}
      />
    </YStack>
  );
};

const BackupWallet = () => {
  const navigation = useAppNavigation();
  const onPick = useCallback(
    async (item: IDBWallet) => {
      const { mnemonic: encodedText } =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId: item.id,
          reason: EReasonForNeedPassword.Security,
        });
      navigation.push(EModalKeyTagRoutes.BackupDotMap, {
        encodedText,
        title: item.name,
      });
    },
    [navigation],
  );
  return (
    <Page>
      <Page.Header title="Backup Wallet" />
      <Page.Body>
        <WalletListView
          ListFooterComponent={ListFooterComponent}
          onPick={onPick}
        />
      </Page.Body>
    </Page>
  );
};

export default BackupWallet;
