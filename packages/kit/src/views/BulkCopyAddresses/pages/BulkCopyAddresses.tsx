import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { flatten, groupBy, isEmpty, isNaN, map } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Empty,
  Form,
  Icon,
  Input,
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
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IModalBulkCopyAddressesParamList } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { showBatchCreateAccountProcessingDialog } from '../../AccountManagerStacks/pages/BatchCreateAccount/ProcessingDialog';

enum EBulkCopyType {
  Account = 'account',
  Range = 'range',
}

function BulkCopyAddressesProcessingInfo({
  progressCurrent,
  progressTotal,
}: {
  progressCurrent: number;
  progressTotal: number;
}) {
  const intl = useIntl();
  return (
    <Stack justifyContent="center" alignItems="center" flex={1}>
      <SizableText size="$headingLg">
        {intl.formatMessage(
          {
            id: ETranslations.global_fetching_addresses,
          },
          {
            current: progressCurrent ?? 0,
            total: progressTotal ?? 0,
          },
        )}
      </SizableText>
    </Stack>
  );
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
  const [isGeneratingAddresses, setIsGeneratingAddresses] = useState(false);
  const walletsMap = useRef<
    Record<string, IDBWallet & { parentWalletName?: string }>
  >({});
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

  const formRange = useForm({
    defaultValues: {
      deriveType: '',
      startIndex: 1,
      amount: 10,
    },
    mode: 'onChange',
  });

  const { selectedWalletId, selectedNetworkId } = form.watch();
  const formRangeWatchFields = formRange.watch();

  const { result: availableWallets } = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      ignoreEmptySingletonWalletAccounts: true,
      ignoreNonBackedUpWallets: true,
      nestedHiddenWallets: true,
      includingAccounts: true,
    });

    const availableWalletsTemp: (IDBWallet & {
      parentWalletName?: string;
    })[] = [];

    wallets.forEach((wallet) => {
      if (
        !accountUtils.isQrWallet({ walletId: wallet.id }) &&
        !accountUtils.isOthersWallet({ walletId: wallet.id }) &&
        !wallet.deprecated
      ) {
        availableWalletsTemp.push(wallet);
        walletsMap.current[wallet.id] = wallet;
        if (wallet.hiddenWallets?.length) {
          wallet.hiddenWallets.forEach((hiddenWallet) => {
            if (!hiddenWallet.deprecated) {
              availableWalletsTemp.push({
                ...hiddenWallet,
                parentWalletName: wallet.name,
              });
              walletsMap.current[hiddenWallet.id] = {
                ...hiddenWallet,
                parentWalletName: wallet.name,
              };
            }
          });
        }
      }
    });

    return availableWalletsTemp;
  }, []);

  const selectedWallet = walletsMap.current[selectedWalletId ?? ''];

  const { vaultSettings } = useAccountData({
    networkId: selectedNetworkId,
  });

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
    // exclude lightning network
    return networkIdsCompatible.filter(
      (id) => !networkUtils.isLightningNetworkByNetworkId(id),
    );
  }, [selectedWalletId]);

  const { result: networkAccountsByDeriveType, isLoading: isLoadingAccounts } =
    usePromiseResult(
      async () => {
        if (copyType !== EBulkCopyType.Account) {
          return {};
        }

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
      [selectedNetworkId, selectedWallet, copyType],
      {
        watchLoading: true,
      },
    );

  const handleGenerateAddresses = useCallback(async () => {
    if (
      !formRangeWatchFields.deriveType ||
      !selectedNetworkId ||
      !selectedWalletId ||
      !vaultSettings?.accountDeriveInfo
    ) {
      return {};
    }
    setIsGeneratingAddresses(true);

    try {
      const fromIndex = new BigNumber(formRangeWatchFields.startIndex)
        .minus(1)
        .toNumber();
      const toIndex = new BigNumber(fromIndex)
        .plus(formRangeWatchFields.amount)
        .minus(1)
        .toNumber();

      const params = {
        walletId: selectedWalletId,
        networkId: selectedNetworkId,
        deriveType: formRangeWatchFields.deriveType as IAccountDeriveTypes,
        fromIndex,
        toIndex,
        saveToDb: false,
        hideCheckingDeviceLoading: true,
        showUIProgress: true,
        excludedIndexes: [],
      };

      showBatchCreateAccountProcessingDialog({
        navigation,
        closeAfterDone: true,
        closeAfterCancel: true,
        closeAfterError: true,
        renderProgressContent: ({ progressCurrent }) => (
          <BulkCopyAddressesProcessingInfo
            progressCurrent={progressCurrent}
            progressTotal={formRangeWatchFields.amount}
          />
        ),
      });

      await timerUtils.wait(600);

      try {
        const { accountsForCreate } =
          await backgroundApiProxy.serviceBatchCreateAccount.startBatchCreateAccountsFlow(
            {
              mode: 'advanced',
              saveToCache: true,
              params,
            },
          );
        return {
          [formRangeWatchFields.deriveType]: accountsForCreate.map(
            (account) => {
              return {
                account,
                deriveType: formRangeWatchFields.deriveType,
                deriveInfo:
                  // @ts-ignore
                  vaultSettings.accountDeriveInfo[
                    formRangeWatchFields.deriveType as IAccountDeriveTypes
                  ],
              };
            },
          ),
        };
      } catch (error) {
        console.log(error);
        throw error;
      }
    } finally {
      setIsGeneratingAddresses(false);
    }
  }, [
    formRangeWatchFields.deriveType,
    formRangeWatchFields.startIndex,
    formRangeWatchFields.amount,
    selectedNetworkId,
    selectedWalletId,
    vaultSettings?.accountDeriveInfo,
    navigation,
  ]);

  const handleFormValueOnChange = useCallback(
    ({
      name,
      value,
      intRequired,
    }: {
      name: string;
      value: string | undefined;
      intRequired?: boolean;
    }) => {
      const filedName = name as keyof typeof formRangeWatchFields;
      const valueBN = new BigNumber(value ?? 0);
      if (valueBN.isNaN()) {
        const formattedValue = parseFloat(value ?? '');
        formRange.setValue(
          filedName,
          isNaN(formattedValue) ? '' : String(formattedValue),
        );
        return;
      }

      if (intRequired) {
        formRange.setValue(filedName, valueBN.toFixed(0));
      } else if (!value?.includes('.')) {
        formRange.setValue(filedName, valueBN.toFixed());
      }
    },
    [formRange],
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

  const renderBulkCopyByRange = useCallback(() => {
    if (copyType !== EBulkCopyType.Range) {
      return null;
    }

    return (
      <Stack>
        <Form form={formRange}>
          <Form.Field
            name="deriveType"
            label={intl.formatMessage({
              id: ETranslations.global_derivation_path,
            })}
          >
            <Select
              title={intl.formatMessage({
                id: ETranslations.global_derivation_path,
              })}
              items={Object.entries(vaultSettings?.accountDeriveInfo ?? {}).map(
                ([deriveType, deriveInfo]) => ({
                  label: deriveInfo.labelKey
                    ? intl.formatMessage({ id: deriveInfo.labelKey })
                    : deriveInfo.label ?? '',
                  value: deriveType as IAccountDeriveTypes,
                }),
              )}
              floatingPanelProps={{
                width: '$78',
              }}
            />
          </Form.Field>
          <Form.Field
            name="startIndex"
            label={intl.formatMessage({
              id: ETranslations.global_from,
            })}
            rules={{
              required: true,
              min: 1,
              onChange: (e: { target: { name: string; value: string } }) =>
                handleFormValueOnChange({
                  name: e.target.name,
                  value: e.target.value,
                  intRequired: true,
                }),
            }}
          >
            <Input />
          </Form.Field>
          <Form.Field
            name="amount"
            label={intl.formatMessage({
              id: ETranslations.global_generate_amount,
            })}
            rules={{
              required: true,
              min: 1,
              max: 100,
              onChange: (e: { target: { name: string; value: string } }) =>
                handleFormValueOnChange({
                  name: e.target.name,
                  value: e.target.value,
                  intRequired: true,
                }),
            }}
          >
            <Input
              addOns={[
                {
                  label: '1',
                  onPress: () => {
                    formRange.setValue('amount', 1);
                    void formRange.trigger('amount');
                  },
                },
                {
                  label: '10',
                  onPress: () => {
                    formRange.setValue('amount', 10);
                    void formRange.trigger('amount');
                  },
                },
                {
                  label: '100',
                  onPress: () => {
                    formRange.setValue('amount', 100);
                    void formRange.trigger('amount');
                  },
                },
              ]}
            />
          </Form.Field>
        </Form>
      </Stack>
    );
  }, [
    copyType,
    formRange,
    intl,
    vaultSettings?.accountDeriveInfo,
    handleFormValueOnChange,
  ]);

  const handleExportAddresses = useCallback(async () => {
    if (copyType === EBulkCopyType.Account) {
      navigation.push(EModalBulkCopyAddressesRoutes.ExportAddressesModal, {
        walletId: selectedWalletId,
        networkId: selectedNetworkId,
        networkAccountsByDeriveType,
        parentWalletName: selectedWallet?.parentWalletName,
      });
    } else if (copyType === EBulkCopyType.Range) {
      const resp = await handleGenerateAddresses();
      navigation.push(EModalBulkCopyAddressesRoutes.ExportAddressesModal, {
        walletId: selectedWalletId,
        networkId: selectedNetworkId,
        networkAccountsByDeriveType: resp,
        parentWalletName: selectedWallet?.parentWalletName,
      });
    }
  }, [
    copyType,
    navigation,
    selectedWalletId,
    selectedNetworkId,
    networkAccountsByDeriveType,
    handleGenerateAddresses,
    selectedWallet?.parentWalletName,
  ]);

  useEffect(() => {
    const getDefaultDeriveType = async () => {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: selectedNetworkId,
        });
      formRange.setValue('deriveType', deriveType);
    };
    void getDefaultDeriveType();
  }, [formRange, selectedNetworkId]);

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
                  label: wallet.parentWalletName
                    ? `${wallet.parentWalletName} - ${wallet.name}`
                    : wallet.name,
                  value: wallet.id,
                  leading: <WalletAvatar wallet={wallet} size="$6" />,
                }))}
                renderTrigger={({ label }) => {
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
                floatingPanelProps={{
                  width: '$78',
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
            {renderBulkCopyByRange()}
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
            loading:
              copyType === EBulkCopyType.Account
                ? false
                : isGeneratingAddresses,
            disabled:
              copyType === EBulkCopyType.Account
                ? !form.formState.isValid ||
                  isLoadingAccounts ||
                  !networkAccountsByDeriveType ||
                  isEmpty(networkAccountsByDeriveType)
                : !form.formState.isValid ||
                  !formRange.formState.isValid ||
                  isGeneratingAddresses,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BulkCopyAddresses;
