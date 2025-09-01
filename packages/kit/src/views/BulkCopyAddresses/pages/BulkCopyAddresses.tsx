import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { flatten, groupBy, isEmpty, isNaN, isNil, map } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
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
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IBatchBuildAccountsAdvancedFlowParams,
  IBatchBuildAccountsNormalFlowParams,
} from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IModalBulkCopyAddressesParamList } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { BATCH_CREATE_ACCONT_MAX_COUNT } from '../../AccountManagerStacks/pages/BatchCreateAccount/BatchCreateAccountFormBase';
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
    <SizableText size="$bodyLg" textAlign="center" flex={1}>
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
      startIndex: '1',
      amount: '10',
    },
    mode: 'onChange',
  });

  const { selectedWalletId, selectedNetworkId } = form.watch();
  const formRangeWatchFields = formRange.watch();

  const isHwWallet = accountUtils.isHwWallet({ walletId: selectedWalletId });

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
        if (!wallet.isMocked) {
          availableWalletsTemp.push(wallet);
        }
        walletsMap.current[wallet.id] = wallet;
        if (wallet.hiddenWallets?.length) {
          wallet.hiddenWallets.forEach((hiddenWallet) => {
            if (!hiddenWallet.deprecated && !hiddenWallet.isMocked) {
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

  const {
    result: { networkAccountsByDeriveType, networkAccounts },
    isLoading: isLoadingAccounts,
  } = usePromiseResult(
    async () => {
      if (copyType !== EBulkCopyType.Account) {
        return {};
      }

      if (!selectedNetworkId || !selectedWallet) {
        return {};
      }

      const { dbIndexedAccounts } = selectedWallet;

      const accountsRequest = dbIndexedAccounts?.map(async (indexedAccount) => {
        return backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: selectedNetworkId,
            indexedAccountId: indexedAccount.id,
            excludeEmptyAccount: true,
          },
        );
      });

      const resp = await Promise.all(accountsRequest ?? []);

      return {
        networkAccounts: resp,
        networkAccountsByDeriveType: groupBy(
          flatten(map(resp, 'networkAccounts')),
          'deriveType',
        ),
      };
    },
    [selectedNetworkId, selectedWallet, copyType],
    {
      watchLoading: true,
      initResult: {
        networkAccounts: [],
        networkAccountsByDeriveType: {},
      },
    },
  );

  const handleGenerateAddresses = useCallback(
    async ({
      addressCount,
      isAdvancedMode,
      advancedParams,
      normalParams,
    }: {
      addressCount: number;
      isAdvancedMode: boolean;
      advancedParams: IBatchBuildAccountsAdvancedFlowParams | undefined;
      normalParams: IBatchBuildAccountsNormalFlowParams | undefined;
    }) => {
      if (!selectedWalletId || !selectedNetworkId) {
        return {};
      }

      try {
        setIsGeneratingAddresses(true);

        showBatchCreateAccountProcessingDialog({
          navigation,
          closeAfterDone: true,
          closeAfterCancel: true,
          closeAfterError: true,
          renderProgressContent: ({ progressCurrent }) => (
            <BulkCopyAddressesProcessingInfo
              progressCurrent={progressCurrent}
              progressTotal={addressCount}
            />
          ),
          onDialogClose: () => {
            setIsGeneratingAddresses(false);
          },
        });

        await timerUtils.wait(600);

        try {
          const { accountsForCreate } =
            await backgroundApiProxy.serviceBatchCreateAccount.startBatchCreateAccountsFlow(
              isAdvancedMode
                ? {
                    mode: 'advanced',
                    saveToCache: false,
                    params: checkIsDefined(advancedParams),
                  }
                : {
                    mode: 'normal',
                    saveToCache: false,
                    params: checkIsDefined(normalParams),
                  },
            );

          // @ts-ignore
          const result: Record<
            IAccountDeriveTypes,
            {
              account: IBatchCreateAccount;
              deriveType: IAccountDeriveTypes;
              deriveInfo?: IAccountDeriveInfo;
            }[]
          > = {};
          for (const account of accountsForCreate) {
            const accountDeriveType =
              await backgroundApiProxy.serviceNetwork.getDeriveTypeByTemplate({
                accountId: account.id,
                networkId: selectedNetworkId,
                template: account.template,
              });
            result[accountDeriveType.deriveType] =
              result[accountDeriveType.deriveType] ?? [];
            result[accountDeriveType.deriveType]?.push({
              account,
              deriveType: accountDeriveType.deriveType,
              deriveInfo: accountDeriveType.deriveInfo,
            });
          }
          return result;
        } catch (error) {
          appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
            totalCount: 0,
            createdCount: 0,
            progressTotal: 0,
            progressCurrent: 0,
            error: error as IOneKeyError,
          });
          throw error;
        }
      } finally {
        setIsGeneratingAddresses(false);
      }
    },
    [selectedWalletId, selectedNetworkId, navigation],
  );

  const handleGenerateAddressesByRange = useCallback(async () => {
    if (
      !selectedWalletId ||
      !selectedNetworkId ||
      !formRangeWatchFields.deriveType
    ) {
      return {};
    }

    const fromIndex = new BigNumber(formRangeWatchFields.startIndex)
      .minus(1)
      .toNumber();
    const toIndex = new BigNumber(fromIndex)
      .plus(formRangeWatchFields.amount)
      .minus(1)
      .toNumber();

    const deriveType = formRangeWatchFields.deriveType as IAccountDeriveTypes;

    const excludedIndexes = {};

    const createAllDeriveTypes = false;

    const advancedParams: IBatchBuildAccountsAdvancedFlowParams = {
      walletId: selectedWalletId,
      networkId: selectedNetworkId,
      deriveType,
      fromIndex,
      toIndex,
      saveToDb: false,
      hideCheckingDeviceLoading: false,
      showUIProgress: true,
      excludedIndexes,
      createAllDeriveTypes,
      errorMessage: intl.formatMessage({
        id: ETranslations.global_bulk_copy_addresses_loading_error,
      }),
    };

    return handleGenerateAddresses({
      isAdvancedMode: true,
      advancedParams,
      normalParams: undefined,
      addressCount: Number(formRangeWatchFields.amount),
    });
  }, [
    formRangeWatchFields.deriveType,
    formRangeWatchFields.startIndex,
    formRangeWatchFields.amount,
    selectedWalletId,
    selectedNetworkId,
    intl,
    handleGenerateAddresses,
  ]);

  const handleGenerateAddressesByAccounts = useCallback(async () => {
    if (
      !selectedWalletId ||
      !selectedNetworkId ||
      !selectedWallet ||
      !selectedWallet.dbIndexedAccounts
    ) {
      return {};
    }

    const indexes = [];

    for (const networkAccount of networkAccounts ?? []) {
      if (
        networkAccount.networkAccounts.length > 0 &&
        !isNil(networkAccount.networkAccounts[0].account?.pathIndex)
      ) {
        indexes.push(networkAccount.networkAccounts[0].account?.pathIndex);
      }
    }

    let addressCount = indexes.length;

    if (vaultSettings?.mergeDeriveAssetsEnabled) {
      addressCount *= Object.keys(
        vaultSettings?.accountDeriveInfo ?? {},
      ).length;
    }

    const normalParams: IBatchBuildAccountsNormalFlowParams = {
      walletId: selectedWalletId,
      networkId: selectedNetworkId,
      deriveType:
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: selectedNetworkId,
        }),
      saveToDb: false,
      indexes,
      createAllDeriveTypes: true,
      showUIProgress: true,
      errorMessage: intl.formatMessage({
        id: ETranslations.global_bulk_copy_addresses_loading_error,
      }),
      hideCheckingDeviceLoading: false,
      progressTotalCount: addressCount,
    };

    return handleGenerateAddresses({
      isAdvancedMode: false,
      normalParams,
      advancedParams: undefined,
      addressCount,
    });
  }, [
    selectedWalletId,
    selectedNetworkId,
    selectedWallet,
    vaultSettings?.mergeDeriveAssetsEnabled,
    vaultSettings?.accountDeriveInfo,
    intl,
    handleGenerateAddresses,
    networkAccounts,
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

    let shouldShowDeriveType = true;

    const deriveTypes = Object.entries(vaultSettings?.accountDeriveInfo ?? {});

    if (
      deriveTypes.length === 1 &&
      !deriveTypes[0][1].labelKey &&
      !deriveTypes[0][1].label
    ) {
      shouldShowDeriveType = false;
    }

    return (
      <Stack>
        <Form form={formRange}>
          {shouldShowDeriveType ? (
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
                items={Object.entries(
                  vaultSettings?.accountDeriveInfo ?? {},
                ).map(([deriveType, deriveInfo]) => ({
                  label: deriveInfo.labelKey
                    ? intl.formatMessage({ id: deriveInfo.labelKey })
                    : deriveInfo.label ?? '',
                  value: deriveType as IAccountDeriveTypes,
                }))}
                floatingPanelProps={{
                  width: '$78',
                }}
              />
            </Form.Field>
          ) : null}

          <Form.Field
            name="startIndex"
            label={intl.formatMessage({
              id: ETranslations.global_from,
            })}
            rules={{
              required: true,
              min: 1,
              onChange: (e: { target: { name: string; value: string } }) => {
                const value = (e?.target?.value || '').replace(/\D/g, '');
                const valueNum = new BigNumber(parseInt(value, 10));
                const maxValue = new BigNumber(
                  BATCH_CREATE_ACCONT_MAX_COUNT,
                ).minus(100);
                if (!value || valueNum.isNaN()) {
                  formRange.setValue('startIndex', '');
                  return;
                }
                if (valueNum.isLessThan(1)) {
                  formRange.setValue('startIndex', '');
                  return;
                }
                if (valueNum.isGreaterThanOrEqualTo(maxValue)) {
                  formRange.setValue('startIndex', maxValue.toFixed());
                  return;
                }
                formRange.setValue('startIndex', valueNum.toFixed());
              },
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
              validate: (value: string) => {
                const valueNum = new BigNumber(value);
                if (valueNum.isGreaterThan(100)) {
                  return intl.formatMessage(
                    {
                      id: ETranslations.global_generate_amount_information,
                    },
                    {
                      max: 100,
                    },
                  );
                }
                return true;
              },
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
                    formRange.setValue('amount', '1');
                    void formRange.trigger('amount');
                  },
                },
                {
                  label: '10',
                  onPress: () => {
                    formRange.setValue('amount', '10');
                    void formRange.trigger('amount');
                  },
                },
                {
                  label: '100',
                  onPress: () => {
                    formRange.setValue('amount', '100');
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

  const handleExportAddresses = useCallback(
    async ({ exportWithoutDevice }: { exportWithoutDevice?: boolean }) => {
      if (copyType === EBulkCopyType.Account) {
        let accountsData = networkAccountsByDeriveType;
        if (isHwWallet && !exportWithoutDevice) {
          accountsData = await handleGenerateAddressesByAccounts();
        }

        navigation.push(EModalBulkCopyAddressesRoutes.ExportAddressesModal, {
          walletId: selectedWalletId,
          networkId: selectedNetworkId,
          networkAccountsByDeriveType: accountsData,
          parentWalletName: selectedWallet?.parentWalletName,
          exportWithoutDevice,
        });
      } else if (copyType === EBulkCopyType.Range) {
        const resp = await handleGenerateAddressesByRange();
        navigation.push(EModalBulkCopyAddressesRoutes.ExportAddressesModal, {
          walletId: selectedWalletId,
          networkId: selectedNetworkId,
          networkAccountsByDeriveType: resp,
          exportWithoutDevice,
          parentWalletName: selectedWallet?.parentWalletName,
        });
      }
    },
    [
      copyType,
      networkAccountsByDeriveType,
      selectedWalletId,
      navigation,
      selectedNetworkId,
      selectedWallet?.parentWalletName,
      handleGenerateAddressesByAccounts,
      handleGenerateAddressesByRange,
      isHwWallet,
    ],
  );

  const isLoading = useMemo(() => {
    return isGeneratingAddresses;
  }, [isGeneratingAddresses]);

  const isDisabled = useMemo(() => {
    return copyType === EBulkCopyType.Account
      ? !form.formState.isValid ||
          isLoadingAccounts ||
          !networkAccountsByDeriveType ||
          isEmpty(networkAccountsByDeriveType)
      : !form.formState.isValid ||
          !formRange.formState.isValid ||
          !selectedWallet ||
          isGeneratingAddresses;
  }, [
    copyType,
    form.formState.isValid,
    isLoadingAccounts,
    networkAccountsByDeriveType,
    formRange.formState.isValid,
    isGeneratingAddresses,
    selectedWallet,
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

  useEffect(() => {
    if (availableWallets?.length && !selectedWallet) {
      form.setValue('selectedWalletId', availableWallets?.[0]?.id);
    }
  }, [availableWallets, selectedWallet, form]);

  return (
    <Page scrollEnabled>
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
                      <SizableText
                        flex={1}
                        px={sharedStyles.px}
                        size="$bodyLg"
                        numberOfLines={1}
                      >
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
        <YStack
          p="$5"
          bg="$bgApp"
          alignItems="center"
          justifyContent="space-between"
          flexDirection="row-reverse"
          $md={{
            flexDirection: 'column',
            gap: '$5',
            justifyContent: 'center',
          }}
        >
          <Button
            variant="primary"
            size="medium"
            onPress={() =>
              handleExportAddresses({
                exportWithoutDevice: false,
              })
            }
            $md={{
              width: '100%',
              size: 'large',
            }}
            loading={isLoading}
            disabled={isDisabled}
          >
            {intl.formatMessage({
              id: isHwWallet
                ? ETranslations.global_action_verify_and_export
                : ETranslations.global_export,
            })}
          </Button>
          {isHwWallet && copyType === EBulkCopyType.Account ? (
            <Button
              size="medium"
              variant="tertiary"
              disabled={isDisabled}
              $md={{
                width: '100%',
              }}
              onPress={() => {
                Dialog.confirm({
                  icon: 'ErrorOutline',
                  tone: 'warning',
                  title: intl.formatMessage({
                    id: ETranslations.global_receive_address_confirmation,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.global_receive_address_confirmation_desc,
                  }),
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_receive_address_confirmation_button,
                  }),
                  onConfirm: () => {
                    void handleExportAddresses({
                      exportWithoutDevice: true,
                    });
                  },
                  confirmButtonProps: {
                    variant: 'secondary',
                  },
                });
              }}
            >
              {intl.formatMessage({
                id: ETranslations.global_bulk_copy_addresses_action_export_without_device,
              })}
            </Button>
          ) : null}
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export default BulkCopyAddresses;
