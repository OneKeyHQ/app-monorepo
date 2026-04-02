import { useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes/accountManagerStacks';

function SameWalletItem({
  walletHash,
  wallets,
  onSelect,
}: {
  walletHash: string;
  wallets: IDBWallet[];
  onSelect: (params: { walletId: string; walletHash: string }) => void;
}) {
  const [checkedWalletId, setCheckedWalletId] = useState<string>('');
  const firstWalletId = wallets?.[0]?.id ?? '';
  useEffect(() => {
    if (!checkedWalletId) {
      setCheckedWalletId(firstWalletId);
    }
  }, [checkedWalletId, firstWalletId]);

  useEffect(() => {
    if (checkedWalletId) {
      onSelect({
        walletId: checkedWalletId,
        walletHash,
      });
    }
  }, [checkedWalletId, onSelect, walletHash]);

  return (
    <Stack bg="$gray5" my="$2">
      {wallets.map((wallet) => {
        const isChecked = wallet.id === checkedWalletId;
        return (
          <XStack
            alignItems="center"
            onPress={() => {
              setCheckedWalletId(wallet.id);
            }}
            key={wallet.id}
          >
            <Stack w="$10" h="$10">
              {isChecked ? (
                <Checkbox value={wallet.id === checkedWalletId} />
              ) : null}
            </Stack>
            <WalletAvatar wallet={wallet} />
            <SizableText>{wallet.name}</SizableText>
          </XStack>
        );
      })}
    </Stack>
  );
}

export default function PageResolveSameWallets({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.PageResolveSameWallets
>) {
  const intl = useIntl();
  const [isRemoving, setIsRemoving] = useState(false);
  const sameWallets = useMemo(
    () => route.params.sameWallets ?? [],
    [route.params.sameWallets],
  );
  const selectedWalletsMap = useRef<{
    [walletHash: string]: string; // walletId
  }>({});

  const navigation = useAppNavigation();

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header title="Resolve Same Wallets" />
      <Page.Body>
        <SizableText>
          The following wallets are duplicates; you can only keep one, the other
          will be removed.
        </SizableText>

        <SizableText
          mt="$4"
          size="$heading2xl"
          onPress={() => {
            console.log('sameWallets: ', sameWallets);
          }}
        >
          Wallet:
        </SizableText>
        {sameWallets.map((item) => (
          <SameWalletItem
            key={item.walletHash}
            {...item}
            onSelect={(params) => {
              selectedWalletsMap.current[item.walletHash] = params.walletId;
            }}
          />
        ))}
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_done,
        })}
        confirmButtonProps={{
          disabled: false,
          loading: isRemoving,
        }}
        onConfirm={() => {
          Dialog.confirm({
            title: 'Confirm',
            description:
              'Are you sure you want to remove the unselected wallets?',
            confirmButtonProps: {
              variant: 'destructive',
              loading: isRemoving,
            },
            onConfirmText: intl.formatMessage({
              id: ETranslations.remove_wallet,
            }),
            onConfirm: async () => {
              try {
                setIsRemoving(true);
                // TODO remove this component
                await backgroundApiProxy.serviceAccount.mergeDuplicateHDWallets(
                  { password: '' },
                );
                // TODO accountSelector action autoSelect next wallet
                navigation.popStack();
              } finally {
                setIsRemoving(false);
              }
            },
          });
        }}
      />
    </Page>
  );
}
