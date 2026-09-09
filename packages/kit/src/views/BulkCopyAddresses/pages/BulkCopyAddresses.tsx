import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { flatten, groupBy, isEmpty, isNaN, map } from 'lodash';
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
} from '@onekeyhq/components';
import { getSharedInputStyles } from '@onekeyhq/components/src/forms/Input/sharedStyles';
import { useForm } from '@onekeyhq/components/src/hooks/useForm';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IBatchBuildAccountsAdvancedFlowParams,
  IBatchBuildAccountsNormalFlowParams,
} from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
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
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ControlledNetworkSelectorTrigger } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import { WalletAvatar } from '../../../components/WalletAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EmptyNoWalletView } from '../../AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/EmptyView';
import { BATCH_CREATE_ACCONT_MAX_COUNT } from '../../AccountManagerStacks/pages/BatchCreateAccount/BatchCreateAccountFormBase';
import { showBatchCreateAccountProcessingDialog } from '../../AccountManagerStacks/pages/BatchCreateAccount/ProcessingDialog';
import { BulkCopyAddressesTestIDs } from '../testIDs';
import { buildBulkCopyByAccountsFlowParams } from '../utils/buildBulkCopyByAccountsParams';
import { computeBulkCopyByAccountsViewState } from '../utils/bulkCopyAddressesViewState';

enum EBulkCopyType {
  Account = 'account',
  Range = 'range',
}

type IBulkCopyWallet = IDBWallet & { parentWalletName?: string };

type IBulkCopyNetworkAccounts = Awaited<
  ReturnType<
    typeof backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes
  >
>;

type IBulkCopyAccountsResult = {
  // False until a load for the current wallet / network has completed, so
  // the list can tell "not loaded yet" from "loaded and empty" (OK-61586).
  loaded: boolean;
  // A completed load whose enumeration rejected: rendered as a retryable
  // error instead of an endless skeleton, and never persisted or exported.
  loadFailed: boolean;
  networkAccounts: IBulkCopyNetworkAccounts[];
  networkAccountsByDeriveType: Record<
    string,
    IBulkCopyNetworkAccounts['networkAccounts']
  >;
};

const EMPTY_ACCOUNTS_RESULT: IBulkCopyAccountsResult = {
  loaded: false,
  loadFailed: false,
  networkAccounts: [],
  networkAccountsByDeriveType: {},
};

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

  const { result: availableWallets, run: refreshAvailableWallets } =
    usePromiseResult(
      async () => {
        const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
          ignoreEmptySingletonWalletAccounts: true,
          ignoreNonBackedUpWallets: true,
          nestedHiddenWallets: true,
          includingAccounts: true,
        });

        const availableWalletsTemp: IBulkCopyWallet[] = [];

        const isWalletDeactivatedBotWallet = async (id: string) => {
          if (!accountUtils.isBotWallet({ walletId: id })) {
            return false;
          }
          return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
            walletId: id,
          });
        };

        for (const wallet of wallets) {
          if (
            !accountUtils.isQrWallet({ walletId: wallet.id }) &&
            !accountUtils.isOthersWallet({ walletId: wallet.id }) &&
            !wallet.deprecated
          ) {
            // eslint-disable-next-line no-await-in-loop
            const isWalletDeactivated = await isWalletDeactivatedBotWallet(
              wallet.id,
            );
            if (!wallet.isMocked && !isWalletDeactivated) {
              availableWalletsTemp.push(wallet);
            }
            if (wallet.hiddenWallets?.length) {
              for (const hiddenWallet of wallet.hiddenWallets) {
                if (!hiddenWallet.deprecated && !hiddenWallet.isMocked) {
                  // eslint-disable-next-line no-await-in-loop
                  const isHiddenWalletDeactivated =
                    await isWalletDeactivatedBotWallet(hiddenWallet.id);
                  if (!isHiddenWalletDeactivated) {
                    availableWalletsTemp.push({
                      ...hiddenWallet,
                      parentWalletName: wallet.name,
                    });
                  }
                }
              }
            }
          }
        }

        return availableWalletsTemp;
      },
      [],
      {
        // Snapshot so a re-entry paints the wallet picker immediately; the
        // fresh list replaces it as soon as the request resolves (OK-61586).
        swrKey: swrKeys.bulkCopyAddressesWallets(),
      },
    );

  // Derived from the current list (cached or fresh) so a deactivated wallet
  // that was previously selectable cannot stay reachable once its status
  // flips, and a cached list resolves the selection on the first frame.
  const walletsMap = useMemo(() => {
    const walletsMapTemp: Record<string, IBulkCopyWallet> = {};
    for (const wallet of availableWallets ?? []) {
      walletsMapTemp[wallet.id] = wallet;
    }
    return walletsMapTemp;
  }, [availableWallets]);

  // Keep the available-wallet list reactive: bot wallet activate /
  // deactivate emits WalletUpdate (debounced) — without this the picker
  // would still show the wallet until the user navigates away and back.
  useEffect(() => {
    appEventBus.on(EAppEventBusNames.WalletUpdate, refreshAvailableWallets);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, refreshAvailableWallets);
    };
  }, [refreshAvailableWallets]);

  // If the wallet that was passed in via route params (or previously selected)
  // is no longer available — e.g. it became a deactivated Bot Wallet and was
  // filtered out — fall back to the first available wallet so the page does
  // not silently keep operating on a hidden, blocked wallet.
  useEffect(() => {
    if (!availableWallets || availableWallets.length === 0) {
      return;
    }
    if (!selectedWalletId || !walletsMap[selectedWalletId]) {
      form.setValue('selectedWalletId', availableWallets[0].id);
    }
  }, [availableWallets, selectedWalletId, form, walletsMap]);

  const selectedWallet = walletsMap[selectedWalletId ?? ''];

  const { vaultSettings } = useAccountData({
    networkId: selectedNetworkId,
  });

  const { result: availableNetworksIds } = usePromiseResult(
    async () => {
      if (!selectedWalletId) {
        return [];
      }

      const { networks } =
        await backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeAllNetworkItem: true,
        });
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
    },
    [selectedWalletId],
    {
      swrKey: selectedWalletId
        ? swrKeys.bulkCopyAddressesNetworkIds({ walletId: selectedWalletId })
        : undefined,
    },
  );

  const accountsScopeKey =
    selectedWalletId && selectedNetworkId
      ? swrKeys.bulkCopyAddressesAccounts({
          walletId: selectedWalletId,
          networkId: selectedNetworkId,
        })
      : undefined;
  // Scope of the last enumeration that completed in this session. A
  // persisted snapshot may paint the first frame, but export must never
  // forward it before a load for the same wallet / network confirmed the
  // accounts still exist (wallet / account mutations while the page was
  // unmounted, or a snapshot from a previous run).
  const freshAccountsScopeKeyRef = useRef<string | undefined>(undefined);

  const loadAccounts =
    useCallback(async (): Promise<IBulkCopyAccountsResult> => {
      if (copyType !== EBulkCopyType.Account) {
        return EMPTY_ACCOUNTS_RESULT;
      }

      if (!selectedNetworkId || !selectedWallet) {
        return EMPTY_ACCOUNTS_RESULT;
      }

      const { dbIndexedAccounts } = selectedWallet;

      const settled = await Promise.allSettled(
        (dbIndexedAccounts ?? []).map((indexedAccount) =>
          backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: selectedNetworkId,
              indexedAccountId: indexedAccount.id,
              excludeEmptyAccount: true,
            },
          ),
        ),
      );

      const resp: IBulkCopyNetworkAccounts[] = [];
      for (const item of settled) {
        if (item.status === 'rejected') {
          // One failed indexed account used to reject the whole enumeration
          // and leave `loaded: false` (an endless skeleton). Surface it as
          // a retryable error rather than exporting a partial set.
          return { ...EMPTY_ACCOUNTS_RESULT, loaded: true, loadFailed: true };
        }
        resp.push(item.value);
      }

      freshAccountsScopeKeyRef.current = accountsScopeKey;
      return {
        loaded: true,
        loadFailed: false,
        networkAccounts: resp,
        networkAccountsByDeriveType: groupBy(
          flatten(map(resp, 'networkAccounts')),
          'deriveType',
        ),
      };
    }, [accountsScopeKey, copyType, selectedNetworkId, selectedWallet]);

  const {
    result: {
      networkAccountsByDeriveType,
      networkAccounts,
      loaded: accountsLoaded,
      loadFailed: accountsLoadFailed,
    },
    run: runAccounts,
  } = usePromiseResult<IBulkCopyAccountsResult>(
    async () => loadAccounts(),
    [loadAccounts],
    {
      initResult: EMPTY_ACCOUNTS_RESULT,
      // Snapshot per (wallet, network) so a re-entry renders the previous
      // account groups on the first frame; only completed, successful loads
      // are kept.
      swrKey: accountsScopeKey,
      swrShouldPersist: (result) => result.loaded && !result.loadFailed,
    },
  );

  const accountsViewState = useMemo(
    () =>
      computeBulkCopyByAccountsViewState({
        isAccountMode: copyType === EBulkCopyType.Account,
        hasSelectedWallet: Boolean(selectedWallet),
        accountsLoaded,
        accountsLoadFailed,
        hasAccounts:
          Boolean(networkAccountsByDeriveType) &&
          !isEmpty(networkAccountsByDeriveType),
        // The wallet / network fields carry no rules, so "no errors" is the
        // real validity here; `formState.isValid` is false on the first
        // frame until react-hook-form's mount validation settles, which
        // would flip the export button grey → black on a cached entry.
        isFormValid: isEmpty(form.formState.errors),
      }),
    [
      copyType,
      selectedWallet,
      accountsLoaded,
      accountsLoadFailed,
      networkAccountsByDeriveType,
      form.formState.errors,
    ],
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
      hideCheckingDeviceLoading: true,
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

  // `accountsForFlow` is the enumeration the export is based on (the
  // current state, or the fresh result of an export-time re-enumeration),
  // so device derivation and the final filter share one account set.
  const handleGenerateAddressesByAccounts = useCallback(
    async (accountsForFlow: IBulkCopyNetworkAccounts[]) => {
      if (
        !selectedWalletId ||
        !selectedNetworkId ||
        !selectedWallet ||
        !selectedWallet.dbIndexedAccounts
      ) {
        return {};
      }

      // Each (network, deriveType) pair carries exactly its own account
      // indexes so the flow fetches one address per existing account — the
      // progress total equals the visible account count, not the
      // (derive types x max indexes) cartesian product (e.g. 13, not 40,
      // for 10 taproot + 1 nested + 1 native + 1 legacy).
      const { customNetworks, indexes, addressCount } =
        buildBulkCopyByAccountsFlowParams({
          networkAccounts: accountsForFlow,
        });

      const normalParams: IBatchBuildAccountsNormalFlowParams = {
        walletId: selectedWalletId,
        networkId: selectedNetworkId,
        // Anchor the flow's seeded (networkId, deriveType) pair on a pair the
        // helper already scoped with indexes; the global derive type is only a
        // fallback for the empty-account edge case.
        deriveType:
          customNetworks[0]?.deriveType ??
          (await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
            {
              networkId: selectedNetworkId,
            },
          )),
        saveToDb: false,
        indexes,
        showUIProgress: true,
        errorMessage: intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses_loading_error,
        }),
        customNetworks,
        hideCheckingDeviceLoading: true,
        progressTotalCount: addressCount,
      };

      return handleGenerateAddresses({
        isAdvancedMode: false,
        normalParams,
        advancedParams: undefined,
        addressCount,
      });
    },
    [
      selectedWalletId,
      selectedNetworkId,
      selectedWallet,
      intl,
      handleGenerateAddresses,
    ],
  );

  type IFiledNameKeys = keyof typeof formRangeWatchFields;
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
      const filedName = name as IFiledNameKeys;
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
    if (accountsViewState.showSkeleton) {
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

    if (accountsViewState.showError) {
      return (
        <Empty
          illustration="WalletOpen"
          title={intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          })}
          buttonProps={{
            children: intl.formatMessage({ id: ETranslations.global_retry }),
            onPress: () => {
              void runAccounts();
            },
          }}
        />
      );
    }

    if (accountsViewState.showEmpty) {
      return (
        <Empty
          illustration="WalletOpen"
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
                    : (deriveInfo.label ?? '')
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
  }, [
    accountsViewState,
    copyType,
    intl,
    networkAccountsByDeriveType,
    runAccounts,
  ]);

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
                testID={BulkCopyAddressesTestIDs.deriveTypeSelect}
                title={intl.formatMessage({
                  id: ETranslations.global_derivation_path,
                })}
                items={Object.entries(
                  vaultSettings?.accountDeriveInfo ?? {},
                ).map(([deriveType, deriveInfo]) => ({
                  label: deriveInfo.labelKey
                    ? intl.formatMessage({ id: deriveInfo.labelKey })
                    : (deriveInfo.label ?? ''),
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
            <Input testID={BulkCopyAddressesTestIDs.startIndexInput} />
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
              testID={BulkCopyAddressesTestIDs.amountInput}
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
        let enumeratedAccounts = networkAccountsByDeriveType;
        let enumeratedNetworkAccounts = networkAccounts;
        if (freshAccountsScopeKeyRef.current !== accountsScopeKey) {
          // Still on the persisted snapshot: re-enumerate before exporting
          // so a wallet / account removed or renamed since the snapshot was
          // taken is never forwarded to the export modal, and an account
          // added since is derived too.
          const fresh = await loadAccounts();
          if (fresh.loadFailed) {
            void runAccounts();
            return;
          }
          enumeratedAccounts = fresh.networkAccountsByDeriveType;
          enumeratedNetworkAccounts = fresh.networkAccounts;
        }
        let accountsData = enumeratedAccounts;
        if (isHwWallet && !exportWithoutDevice) {
          accountsData = await handleGenerateAddressesByAccounts(
            enumeratedNetworkAccounts,
          );
          if (enumeratedAccounts) {
            for (const [deriveType, accounts] of Object.entries(accountsData)) {
              accountsData[deriveType] =
                accounts.filter((account) =>
                  enumeratedAccounts?.[deriveType]?.some(
                    (item) =>
                      item.account &&
                      account.account &&
                      item.account.id === account.account.id,
                  ),
                ) ?? [];
            }
          }
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
      networkAccounts,
      accountsScopeKey,
      loadAccounts,
      runAccounts,
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
      ? accountsViewState.isExportDisabled
      : !form.formState.isValid ||
          !formRange.formState.isValid ||
          !selectedWallet ||
          isGeneratingAddresses;
  }, [
    copyType,
    accountsViewState.isExportDisabled,
    form.formState.isValid,
    formRange.formState.isValid,
    isGeneratingAddresses,
    selectedWallet,
  ]);

  useEffect(() => {
    const getDefaultDeriveType = async () => {
      if (!selectedNetworkId) {
        return;
      }
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

  if (availableWallets && availableWallets.length === 0) {
    return (
      <Page>
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.global_bulk_copy_addresses,
          })}
        />
        <Page.Body>
          <EmptyNoWalletView />
        </Page.Body>
      </Page>
    );
  }

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
                testID={BulkCopyAddressesTestIDs.walletSelect}
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
                      {selectedWallet ? (
                        <WalletAvatar wallet={selectedWallet} size="$6" />
                      ) : (
                        <Skeleton w="$6" h="$6" radius="round" />
                      )}
                      {selectedWallet ? (
                        <SizableText
                          flex={1}
                          px={sharedStyles.px}
                          size="$bodyLg"
                          numberOfLines={1}
                        >
                          {label}
                        </SizableText>
                      ) : (
                        <Stack flex={1} px={sharedStyles.px}>
                          <Skeleton.BodyLg width="$32" />
                        </Stack>
                      )}
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
                testID={BulkCopyAddressesTestIDs.networkSelect}
                networkIds={availableNetworksIds}
              />
            </Form.Field>
          </Form>
          <YStack gap="$5">
            <SegmentControl
              testID={BulkCopyAddressesTestIDs.copyTypeSegment}
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
            testID={BulkCopyAddressesTestIDs.exportBtn}
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
              testID={BulkCopyAddressesTestIDs.exportWithoutDeviceBtn}
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
