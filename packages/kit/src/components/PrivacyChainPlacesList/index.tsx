import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  IconButton,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { PRIVACY_CHAIN_SYNC_STATUS_LABELS } from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

// A full network's accounts keeping local data, paused ones included, each
// deletable here: deleting is the only way to free a place. Accounts sharing a
// key share one row, titled by their address, and are deleted together.
export function PrivacyChainPlacesList({ networkId }: { networkId: string }) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [deletingAccountId, setDeletingAccountId] = useState<string>();
  const { result: rows, run } = usePromiseResult(async () => {
    const [places, accounts] = await Promise.all([
      backgroundApiProxy.servicePrivacyChain.getLocalWalletNetworkPlaces({
        networkId,
      }),
      backgroundApiProxy.servicePrivacyChain.listLocalWalletAccounts(),
    ]);
    const accountById = new Map(
      accounts.map((account) => [account.accountId, account]),
    );
    return Promise.all(
      places.groups.map(async ({ accountIds, address }) => {
        const state =
          await backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountState(
            { networkId, accountId: accountIds[0] },
          );
        const listed = accountIds.flatMap((accountId) => {
          const account = accountById.get(accountId);
          return account ? [account] : [];
        });
        return {
          accountId: accountIds[0],
          address,
          owners: listed.map(
            (account) => `${account.walletName} / ${account.accountName}`,
          ),
          // Accounts sharing a key share its derivation too.
          deriveLabel: listed[0]?.deriveLabel,
          // Accounts of a wallet not open now are not listed by name.
          unlistedCount: accountIds.length - listed.length,
          paused: state.paused,
        };
      }),
    );
  }, [networkId]);

  const deleteData = useCallback(
    (accountId: string) => {
      Dialog.confirm({
        title: intl.formatMessage({
          id: ETranslations.privacy_delete_data__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.privacy_delete_data__desc,
        }),
        tone: 'destructive',
        onConfirmText: intl.formatMessage({ id: ETranslations.global_delete }),
        onConfirm: async () => {
          setDeletingAccountId(accountId);
          try {
            await backgroundApiProxy.servicePrivacyChain.deleteLocalWalletAccountData(
              { networkId, accountId },
            );
            await run();
          } finally {
            setDeletingAccountId(undefined);
          }
        },
      });
    },
    [intl, networkId, run],
  );

  if (!rows) {
    return (
      <Stack py="$4" alignItems="center">
        <Spinner />
      </Stack>
    );
  }
  const deleteLabel = intl.formatMessage({
    id: ETranslations.privacy_delete_data__title,
  });
  type IRow = (typeof rows)[number];
  // One section per derivation, in list order; a chain with one has no header.
  const sections = new Map<string, IRow[]>();
  rows.forEach((row) => {
    const label = row.deriveLabel ?? '';
    sections.set(label, [...(sections.get(label) ?? []), row]);
  });

  const renderRow = (row: IRow) => {
    const owners =
      row.unlistedCount > 0
        ? [
            ...row.owners,
            intl.formatMessage(
              { id: ETranslations.privacy_slots_locked_wallets__msg },
              { count: row.unlistedCount },
            ),
          ]
        : row.owners;
    return (
      <XStack
        key={row.accountId}
        testID={`privacy-chain-places-row-${row.accountId}`}
        alignItems="center"
        gap="$3"
        px="$3"
        py="$2.5"
        mb="$2"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
      >
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {row.address
              ? accountUtils.shortenAddress({ address: row.address })
              : owners[0]}
          </SizableText>
          {owners.map((owner) => (
            <SizableText key={owner} size="$bodyMd" numberOfLines={1}>
              {owner}
            </SizableText>
          ))}
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: row.paused
                ? PRIVACY_CHAIN_SYNC_STATUS_LABELS.accountPaused
                : ETranslations.global_enabled,
            })}
          </SizableText>
        </YStack>
        <IconButton
          testID={`privacy-chain-places-delete-${row.accountId}`}
          icon="DeleteOutline"
          title={deleteLabel}
          aria-label={deleteLabel}
          variant="tertiary"
          loading={deletingAccountId === row.accountId}
          disabled={deletingAccountId !== undefined}
          onPress={() => deleteData(row.accountId)}
        />
      </XStack>
    );
  };

  return (
    // Five blocks with their headers outgrow a small window (the extension):
    // the list scrolls inside the dialog, under its title and above its button.
    <Dialog.ScrollView
      testID="privacy-chain-places"
      maxHeight={gtMd ? 480 : 320}
      mx="$-5"
      px="$5"
    >
      {Array.from(sections, ([label, sectionRows]) => (
        <YStack key={label} testID={`privacy-chain-places-section-${label}`}>
          {label ? (
            <SizableText
              size="$bodyMdMedium"
              color="$textSubdued"
              pt="$1"
              pb="$1.5"
            >
              {label}
            </SizableText>
          ) : null}
          {sectionRows.map(renderRow)}
        </YStack>
      ))}
    </Dialog.ScrollView>
  );
}
