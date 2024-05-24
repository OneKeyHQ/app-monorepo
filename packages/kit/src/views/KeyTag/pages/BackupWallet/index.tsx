import { useCallback } from 'react';

import {
  Divider,
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WalletListView } from '@onekeyhq/kit/src/components/WalletListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

const ListFooterComponent = ({ walletCount }: { walletCount: number }) => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.push(EModalKeyTagRoutes.BackupRecoveryPhrase);
  }, [navigation]);
  return (
    <YStack>
      {walletCount ? (
        <YStack>
          <SizableText size="$bodySm" color="$textSubdued" px="$5" mt="$5">
            Hardware wallets do not currently support backup to KeyTag, only App
            wallets will appear here.
          </SizableText>
          <XStack px="$5" pt="$5" pb="$4">
            <Divider />
          </XStack>
        </YStack>
      ) : null}
      <ListItem
        icon="PencilOutline"
        title="Enter Recovery Phrase"
        drillIn
        onPress={onPress}
        renderIcon={
          <Stack bg="$bgStrong" p="$2" borderRadius="$3">
            <Icon name="PencilOutline" size="$6" color="$icon" />
          </Stack>
        }
      />
    </YStack>
  );
};

const BackupWallet = () => {
  const navigation = useAppNavigation();
  const walletList = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets();
    const hdWalletList = wallets.filter((wallet) =>
      accountUtils.isHdWallet({ walletId: wallet.id }),
    );
    return hdWalletList;
  }, []).result;
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
          walletList={walletList}
          ListFooterComponent={
            <ListFooterComponent walletCount={walletList?.length ?? 0} />
          }
          onPick={onPick}
        />
      </Page.Body>
    </Page>
  );
};

export default BackupWallet;
