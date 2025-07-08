import { useCallback, useMemo, useRef, useState } from 'react';

import { flatten, groupBy, isEmpty, map } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  Form,
  Icon,
  Page,
  SegmentControl,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IModalBulkCopyAddressesParamList } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

enum EBulkCopyType {
  Account = 'account',
  Range = 'range',
}

function BulkCopyAddresses({
  route,
}: IPageScreenProps<
  IModalBulkCopyAddressesParamList,
  EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal
>) {
  const intl = useIntl();
  const { walletId, networkId } = route.params;
  const { gtMd } = useMedia();

  const navigation = useAppNavigation();

  const [copyType, setCopyType] = useState<EBulkCopyType>(
    EBulkCopyType.Account,
  );

  const walletsMap = useRef<Record<string, IDBWallet>>({});

  const sharedStyles = getSharedInputStyles({
    size: 'large',
  });

  const form = useForm({
    defaultValues: {
      selectedWalletId: walletId,
      selectedNetworkId: networkId,
    },
    mode: 'onChange',
  });

  const { selectedWalletId, selectedNetworkId } = form.watch();

  const { result: availableWallets } = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreEmptySingletonWalletAccounts: true,
      ignoreNonBackedUpWallets: true,
      nestedHiddenWallets: true,
      includingAccounts: true,
    });

    const availableWalletsTemp: IDBWallet[] = [];

    wallets.forEach((wallet) => {
      if (
        !accountUtils.isQrWallet({ walletId: wallet.id }) &&
        !accountUtils.isOthersWallet({ walletId: wallet.id })
      ) {
        availableWalletsTemp.push(wallet);
        walletsMap.current[wallet.id] = wallet;
      }
    });

    return availableWalletsTemp;
  }, []);

  const selectedWallet = walletsMap.current[selectedWalletId ?? ''];

  const { result: availableNetworksIds } = usePromiseResult(async () => {
    if (!selectedWalletId) {
      return [];
    }

    const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks(
      {
        excludeAllNetworkItem: true,
      },
    );
    const networkIds = networks.map((network) => network.id);
    const { networkIdsCompatible } =
      await backgroundApiProxy.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
        {
          walletId: selectedWalletId,
          networkIds,
        },
      );
    return networkIdsCompatible;
  }, [selectedWalletId]);

  const { result: networkAccountsByDeriveType, isLoading: isLoadingAccounts } =
    usePromiseResult(
      async () => {
        if (!selectedNetworkId || !selectedWallet) {
          return {};
        }

        const { dbIndexedAccounts } = selectedWallet;

        const accountsRequest = dbIndexedAccounts?.map(
          async (indexedAccount) => {
            return backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                networkId: selectedNetworkId,
                indexedAccountId: indexedAccount.id,
                excludeEmptyAccount: true,
              },
            );
          },
        );

        const resp = await Promise.all(accountsRequest ?? []);

        return groupBy(flatten(map(resp, 'networkAccounts')), 'deriveType');
      },
      [selectedNetworkId, selectedWallet],
      {
        watchLoading: true,
      },
    );

  const renderBulkCopyByAccounts = useCallback(() => {
    if (isLoadingAccounts) {
      return (
        <Skeleton.Group show>
          {Array.from({ length: 3 }).map((_, index) => (
            <XStack
              key={index}
              alignItems="center"
              justifyContent="space-between"
            >
              <Skeleton.BodyLg />
              <Skeleton.BodyMd />
            </XStack>
          ))}
        </Skeleton.Group>
      );
    }

    if (copyType !== EBulkCopyType.Account) {
      return null;
    }

    if (!networkAccountsByDeriveType || isEmpty(networkAccountsByDeriveType)) {
      return (
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      );
    }

    return (
      <Stack>
        {Object.entries(networkAccountsByDeriveType).map(
          ([deriveType, item]) => {
            const { deriveInfo } = item[0];
            return (
              <ListItem
                key={deriveType}
                title={
                  deriveInfo.labelKey
                    ? intl.formatMessage({ id: deriveInfo.labelKey })
                    : deriveInfo.label ?? ''
                }
                mx={0}
                px={0}
                py="$2"
              >
                <ListItem.Text
                  align="right"
                  secondary={intl.formatMessage(
                    {
                      id: ETranslations.global_number_accounts,
                    },
                    { number: item.length },
                  )}
                />
              </ListItem>
            );
          },
        )}
      </Stack>
    );
  }, [copyType, intl, isLoadingAccounts, networkAccountsByDeriveType]);

  const handleExportAddresses = useCallback(() => {
    navigation.push(EModalBulkCopyAddressesRoutes.ExportAddressesModal, {
      walletId: selectedWalletId,
      networkId: selectedNetworkId,
      networkAccountsByDeriveType,
    });
  }, [
    navigation,
    networkAccountsByDeriveType,
    selectedNetworkId,
    selectedWalletId,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        })}
      />
      <Page.Body px="$5">
        <YStack gap="$5">
          <Form form={form}>
            <Form.Field
              name="selectedWalletId"
              label={intl.formatMessage({
                id: ETranslations.global_wallet,
              })}
            >
              <Select
                title={intl.formatMessage({
                  id: ETranslations.global_select_wallet,
                })}
                items={availableWallets?.map((wallet) => ({
                  label: wallet.name,
                  value: wallet.id,
                  leading: <WalletAvatar wallet={wallet} size="$6" />,
                }))}
                renderTrigger={({ value, label }) => {
                  return (
                    // eslint-disable-next-line props-checker/validator
                    <Stack
                      userSelect="none"
                      flexDirection="row"
                      alignItems="center"
                      borderRadius="$3"
                      borderWidth={1}
                      borderCurve="continuous"
                      borderColor="$borderStrong"
                      px="$3"
                      py="$2.5"
                      $gtMd={{
                        borderRadius: '$2',
                        py: '$2',
                      }}
                      hoverStyle={{
                        bg: '$bgHover',
                      }}
                      pressStyle={{
                        bg: '$bgActive',
                      }}
                    >
                      <WalletAvatar wallet={selectedWallet} size="$6" />
                      <SizableText flex={1} px={sharedStyles.px} size="$bodyLg">
                        {label}
                      </SizableText>
                      <Icon
                        name="ChevronDownSmallOutline"
                        mr="$-0.5"
                        color="$iconSubdued"
                      />
                    </Stack>
                  );
                }}
              />
            </Form.Field>
            <Form.Field
              name="selectedNetworkId"
              label={intl.formatMessage({
                id: ETranslations.global_network,
              })}
            >
              <ControlledNetworkSelectorTrigger
                networkIds={availableNetworksIds}
              />
            </Form.Field>
          </Form>
          <YStack gap="$5">
            <SegmentControl
              fullWidth
              value={copyType}
              onChange={(v) => {
                setCopyType(v as EBulkCopyType);
              }}
              options={[
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_bulk_copy_addresses_tabs_my_accounts,
                  }),
                  value: EBulkCopyType.Account,
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_bulk_copy_addresses_tabs_set_range,
                  }),
                  value: EBulkCopyType.Range,
                },
              ]}
            />
            {renderBulkCopyByAccounts()}
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={handleExportAddresses}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_export,
          })}
          confirmButtonProps={{
            size: gtMd ? 'medium' : 'large',
            variant: 'primary',
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BulkCopyAddresses;
