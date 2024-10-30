import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type {
  ICheckedState,
  IPageScreenProps,
  ISelectRenderTriggerProps,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  ButtonGroup,
  Checkbox,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  Popover,
  Select,
  SizableText,
  Spinner,
  Stack,
  Table,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorFormInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IBatchBuildAccountsAdvancedFlowParams,
  IBatchBuildAccountsNormalFlowParams,
} from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import type {
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IBatchCreateAccount,
  INetworkAccount,
} from '@onekeyhq/shared/types/account';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

import { BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT } from './BatchCreateAccountFormBase';
import { showBatchCreateAccountPreviewAdvancedDialog } from './PreviewAdvancedDialog';
import { showBatchCreateAccountPreviewPageNumberDialog } from './PreviewPageNumberDialog';
import { showBatchCreateAccountProcessingDialog } from './ProcessingDialog';

import type { IBatchCreateAccountFormValues } from './BatchCreateAccountFormBase';

function DeriveTypeTrigger({ onPress }: ISelectRenderTriggerProps) {
  return (
    <XStack
      role="button"
      userSelect="none"
      alignItems="center"
      px="$2"
      py="$2"
      borderRadius="$full"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      onPress={onPress}
    >
      <Icon name="BranchesOutline" color="$iconSubdued" size="$6" />
    </XStack>
  );
}

const MemoDeriveTypeTrigger = memo(DeriveTypeTrigger);

function BatchCreateAccountPreviewPage({
  walletId,
  defaultNetworkId,
  defaultFrom,
  defaultCount,
  defaultIsAdvancedMode,
}: {
  walletId: string;
  defaultNetworkId: string;
  defaultFrom: string; // start from 1
  defaultCount: string;
  defaultIsAdvancedMode?: boolean;
}) {
  const [, setEditMode] = useAccountSelectorEditModeAtom();
  const { result: networkIdsCompatibleAccount } = usePromiseResult(
    async () => {
      const { networkIdsCompatible } =
        await backgroundApiProxy.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
          { walletId },
        );
      return networkIdsCompatible;
    },
    [walletId],
    { initResult: undefined },
  );

  const [networkId, setNetworkId] = useState(defaultNetworkId);
  const [isAdvancedMode, setIsAdvancedMode] = useState(
    defaultIsAdvancedMode ?? false,
  );
  const [from, setFrom] = useState(defaultFrom ?? '1');
  const [count, setCount] = useState(
    defaultCount ?? String(BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT),
  );
  const fromInt = useMemo(() => {
    if (isAdvancedMode) {
      return parseInt(from, 10);
    }
    return 1;
  }, [from, isAdvancedMode]);
  const countInt = useMemo(() => {
    if (isAdvancedMode) {
      return parseInt(count, 10);
    }
    return 2 ** 31;
  }, [count, isAdvancedMode]);
  const [advanceExcludedIndexes, setAdvancedExcludedIndexes] = useState<{
    [pathIndex: number]: true;
  }>({});
  const [normalSelectedIndexes, setNormalSelectedIndexes] = useState<{
    [pathIndex: number]: boolean;
  }>({});
  const selectedIndexesCount = useMemo(
    () => Object.values(normalSelectedIndexes).filter(Boolean).length,
    [normalSelectedIndexes],
  );

  const pageSize = 10;
  const minPage = 1;
  const [page, setPage] = useState(minPage);
  const maxPage = useMemo(() => Math.ceil(countInt / pageSize), [countInt]);
  const [deriveType, setDeriveType] = useState<
    IAccountDeriveTypes | undefined
  >();
  const [deriveTypeItems, setDeriveTypeItems] =
    useState<IAccountDeriveInfoItems[]>();

  const showPopoverDeriveTypeInfo = useMemo(
    () =>
      !networkUtils.getDefaultDeriveTypeVisibleNetworks().includes(networkId),
    [networkId],
  );
  const currentDeriveTypeInfo = useMemo(() => {
    if (deriveTypeItems) {
      return deriveTypeItems.find((item) => item.value === deriveType);
    }
    return undefined;
  }, [deriveType, deriveTypeItems]);

  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  const setPageNumber = useCallback(
    (pageNumber: number) => {
      // eslint-disable-next-line no-param-reassign
      pageNumber = parseInt(String(pageNumber), 10);
      if (!Number.isInteger(pageNumber)) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_bulk_accounts_page_number_error,
          }),
        });
        return;
      }
      if (pageNumber < minPage) {
        return setPage(minPage);
      }
      if (pageNumber > maxPage) {
        return setPage(maxPage);
      }
      return setPage(pageNumber);
    },
    [intl, maxPage],
  );

  const enableAdvancedMode = useCallback(
    (values: IBatchCreateAccountFormValues) => {
      setPage(minPage);
      setAdvancedExcludedIndexes({});
      setNormalSelectedIndexes({});
      setFrom(values.from);
      setCount(values.count);
      setDeriveType(values.deriveType);
      setIsAdvancedMode(true);
    },
    [],
  );

  const beginIndex = fromInt - 1;
  const endIndex = beginIndex + countInt - 1;

  const previewTimes = useRef(0);

  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId,
      }),
    [networkId],
  );
  const [balanceMap, setBalanceMap] = useState<{
    [key: string]: string | undefined;
  }>({});
  const balanceMapRef = useRef(balanceMap);
  balanceMapRef.current = balanceMap;

  const {
    result: accounts = [],
    isLoading,
    setResult,
  } = usePromiseResult(
    async () => {
      try {
        defaultLogger.account.accountCreatePerf.createAddressRunStart();
        if (!deriveType) {
          return [];
        }
        previewTimes.current += 1;
        const fromIndexInPage = fromInt - 1 + (page - 1) * pageSize;

        const toIndexInPage = Math.min(
          endIndex,
          fromIndexInPage + pageSize - 1,
        );

        const indexes =
          await backgroundApiProxy.serviceBatchCreateAccount.buildIndexesByFromAndTo(
            {
              fromIndex: fromIndexInPage,
              toIndex: toIndexInPage,
            },
          );

        const { accountsForCreate } =
          await backgroundApiProxy.serviceBatchCreateAccount.previewBatchBuildAccounts(
            {
              walletId,
              networkId,
              deriveType,
              indexes,
              saveToCache: true,
            },
          );
        return accountsForCreate;
      } catch (error) {
        // may be second time error
        if (previewTimes.current === 1) {
          // If an error occurs and exits, the user cannot switch to other networks for addition, such as an error under DNX, and cannot switch to ETH
          // navigation.pop();
        }
        throw error;
      } finally {
        defaultLogger.account.accountCreatePerf.createAddressRunFinished();
      }
    },
    [deriveType, endIndex, fromInt, networkId, page, walletId],
    {
      watchLoading: true,
      debounced: 300,
    },
  );

  useEffect(() => {
    if (networkId) {
      // reset deriveType after network changed
      setDeriveType(undefined);
      setResult([]);
      // DeriveTypeSelectorFormInput shouldResetDeriveTypeWhenNetworkChanged will handle this internally
    }
  }, [networkId, setResult]);

  const buildBalanceMapKey = useCallback(
    ({ account }: { account: IBatchCreateAccount }) =>
      `${networkId}--${account.displayAddress || account.address}--${
        (account as IDBUtxoAccount).xpub
      }`,
    [networkId],
  );

  const refreshBalance = useDebouncedCallback(async () => {
    const toFetchBalanceAccounts: IBatchCreateAccount[] = [];
    for (const account of accounts) {
      const key: string = buildBalanceMapKey({ account });
      if (isNil(balanceMapRef.current[key])) {
        toFetchBalanceAccounts.push(account);
      }
    }
    if (toFetchBalanceAccounts.length) {
      const balancesToUpdate: {
        [key: string]: string | undefined;
      } = {};

      await Promise.all(
        toFetchBalanceAccounts.map(async (account) => {
          try {
            const balances: IFetchAccountDetailsResp =
              await backgroundApiProxy.serviceAccountProfile.fetchAccountNativeBalance(
                {
                  account,
                  networkId,
                },
              );
            // Process the balances here
            balancesToUpdate[buildBalanceMapKey({ account })] =
              balances.balanceParsed;
          } catch (error) {
            //
          }
        }),
      );

      if (Object.keys(balancesToUpdate).length) {
        setBalanceMap((v) => {
          const newValue = { ...v, ...balancesToUpdate };
          return newValue;
        });
      }
    }
  }, 600);

  useEffect(() => {
    if (accounts && !!buildBalanceMapKey && networkId) {
      void refreshBalance();
    }
  }, [accounts, buildBalanceMapKey, networkId, refreshBalance]);

  const selectCheckBox = useCallback(
    ({
      val,
      accountsToSelect,
    }: {
      val: ICheckedState;
      accountsToSelect: IBatchCreateAccount[];
    }) => {
      if (isAdvancedMode) {
        if (val === true) {
          setAdvancedExcludedIndexes((v) => {
            for (const a of accountsToSelect) {
              if (!a.existsInDb) {
                delete v[a.pathIndex ?? -1];
              }
            }
            return { ...v };
          });
        }
        if (val === false) {
          setAdvancedExcludedIndexes((v) => {
            const newValue = { ...v };
            for (const a of accountsToSelect) {
              if (!a.existsInDb) {
                newValue[a.pathIndex ?? -1] = true;
              }
            }
            return newValue;
          });
        }
      } else {
        setNormalSelectedIndexes((v) => {
          const newValue = { ...v };
          for (const a of accountsToSelect) {
            if (!a.existsInDb) {
              newValue[a.pathIndex ?? -1] = !!val;
            }
          }
          return newValue;
        });
      }
    },
    [isAdvancedMode],
  );
  const headerRight = useCallback(
    () => (
      <Stack flexDirection="row" alignItems="center">
        {showPopoverDeriveTypeInfo &&
        currentDeriveTypeInfo &&
        deriveTypeItems &&
        deriveTypeItems?.length > 1 ? (
          <Popover
            title={intl.formatMessage({ id: ETranslations.derivation_path })}
            renderContent={
              <Stack
                px="$4"
                py="$5"
                pt={0}
                $gtMd={{
                  pt: '$5',
                }}
              >
                <SizableText size="$bodyLg" mb="$5">
                  {intl.formatMessage({
                    id: ETranslations.global_generate_amount_select_path,
                  })}
                </SizableText>
                <Divider />
                <Stack mt="$5">
                  <Select.Item
                    label={currentDeriveTypeInfo.label}
                    description={currentDeriveTypeInfo.description}
                  />
                </Stack>
              </Stack>
            }
            renderTrigger={<MemoDeriveTypeTrigger />}
          />
        ) : null}

        <DeriveTypeSelectorFormInput
          visibleOnNetworks={networkUtils.getDefaultDeriveTypeVisibleNetworks()}
          hideIfItemsLTEOne
          value={deriveType}
          onItemsChange={setDeriveTypeItems}
          onChange={(v) => {
            if (deriveType !== v) {
              setDeriveType(v);
            }
          }}
          networkId={networkId || ''}
          defaultTriggerInputProps={{
            size: media.gtMd ? 'medium' : 'large',
          }}
          renderTrigger={DeriveTypeTrigger}
        />

        <ControlledNetworkSelectorTrigger
          value={networkId}
          networkIds={networkIdsCompatibleAccount}
          onChange={setNetworkId}
          excludeAllNetworkItem
          miniMode
          borderWidth={0}
          hitSlop={{
            left: 8,
            top: 8,
            right: 8,
            bottom: 8,
          }}
          mr="$-2"
          px="$2"
          py="$2"
          borderRadius="$full"
          // px="$4"
          // py="$3"
          // borderRadius="$2"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          $gtMd={{
            borderRadius: '$full',
            py: '$2',
          }}
        />
      </Stack>
    ),
    [
      currentDeriveTypeInfo,
      deriveType,
      deriveTypeItems,
      intl,
      media.gtMd,
      networkId,
      showPopoverDeriveTypeInfo,
      networkIdsCompatibleAccount,
    ],
  );

  const totalCount = useMemo<number>(() => {
    if (!isAdvancedMode) {
      return selectedIndexesCount;
    }
    return (
      countInt - Object.values(advanceExcludedIndexes).filter(Boolean).length
    );
  }, [advanceExcludedIndexes, countInt, isAdvancedMode, selectedIndexesCount]);

  const totalCountEstimate = useMemo(() => {
    if (totalCount > 0) {
      return ` (${totalCount})`;
    }
    return '';
  }, [totalCount]);

  const buildRelPathSuffix = useCallback(
    (account: INetworkAccount) => {
      if (networkId === getNetworkIdsMap().dnx) {
        return '';
      }
      if (account.relPath) {
        return `/${account.relPath.replace(/^\/+/, '')}`;
      }
      return '';
    },
    [networkId],
  );

  const getAccountCheckedState = useCallback(
    (account: IBatchCreateAccount) => {
      const pathIndex = account.pathIndex ?? -1;
      let checkedState: ICheckedState = false;
      if (isAdvancedMode) {
        checkedState = true;
        if (advanceExcludedIndexes?.[pathIndex] === true) {
          checkedState = false;
        }
      } else {
        checkedState = normalSelectedIndexes[pathIndex] ?? false;
      }
      if (account.existsInDb) {
        checkedState = 'indeterminate';
      }
      return checkedState;
    },
    [advanceExcludedIndexes, isAdvancedMode, normalSelectedIndexes],
  );

  const columns = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.global_generate_amount_number,
        }),
        titleProps: {
          size: '$bodyMd',
          color: '$textDisabled',
        },
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        dataIndex: 'checkBox',
        columnWidth: 22,
        render: (_: any, account: IBatchCreateAccount) => {
          const checkedState: ICheckedState = getAccountCheckedState(account);
          return (
            <Checkbox
              testID={`batch-create-account-checkbox-${
                account.pathIndex || ''
              }`}
              containerProps={{
                flex: 1,
              }}
              disabled={account.existsInDb}
              value={checkedState}
              onChange={(val) => {
                selectCheckBox({
                  val,
                  accountsToSelect: [account],
                });
              }}
              label={String((account.pathIndex ?? 0) + 1)}
              labelProps={
                {
                  size: '$bodyMd',
                  numberOfLines: 10,
                } as ISizableTextProps
              }
            />
          );
        },
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_generate_amount_address,
        }),
        titleProps: {
          size: '$bodyMd',
          color: '$textDisabled',
        },
        align: 'left',
        dataIndex: 'address',
        columnProps: {
          flexGrow: 6,
          flexBasis: 0,
        },
        render: (_: any, account: IBatchCreateAccount) => (
          <YStack py="$1">
            <SizableText size="$bodyMd">
              {accountUtils.shortenAddress({
                address: account.displayAddress || account.address,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {account.path}
              {buildRelPathSuffix(account)}
            </SizableText>
          </YStack>
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_generate_amount_balance,
        }),
        titleProps: {
          size: '$bodyMd',
          color: '$textDisabled',
        },
        align: 'right',
        dataIndex: 'balance',
        columnProps: {
          flexGrow: 2,
          flexBasis: 0,
        },
        render: (_: any, account: IBatchCreateAccount) => (
          <NumberSizeableText
            size="$bodyMd"
            formatter="balance"
            style={{
              textAlign: 'right',
              wordBreak: 'break-all',
            }}
            formatterOptions={{ tokenSymbol: network?.symbol }}
          >
            {balanceMap[buildBalanceMapKey({ account })] ?? '-'}
          </NumberSizeableText>
        ),
      },
    ],
    [
      balanceMap,
      buildBalanceMapKey,
      buildRelPathSuffix,
      getAccountCheckedState,
      intl,
      network?.symbol,
      selectCheckBox,
    ],
  );

  const onRow = useCallback(
    (account: IBatchCreateAccount) => ({
      onPress: () => {
        const checkedState: ICheckedState = getAccountCheckedState(account);
        if (checkedState !== 'indeterminate') {
          selectCheckBox({
            val: !checkedState,
            accountsToSelect: [account],
          });
        }
      },
    }),
    [getAccountCheckedState, selectCheckBox],
  );

  const extraData = useMemo(
    () => [selectedIndexesCount, balanceMap],
    [selectedIndexesCount, balanceMap],
  );

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.send_preview_button,
        })}
        dismissOnOverlayPress={false}
        headerRight={headerRight}
      />
      <Page.Body>
        <Table
          onRow={onRow}
          rowProps={{
            gap: platformEnv.isNative ? '$8' : '$4',
            px: '$3',
            mx: '$2',
            minHeight: '$12',
          }}
          estimatedItemSize="$12"
          headerRowProps={{ py: '$2', minHeight: 36 }}
          dataSource={isLoading ? [] : accounts}
          columns={columns as any}
          TableEmptyComponent={
            <Stack
              testID="batch-create-account-preview-loading-icon"
              py="$20"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <Spinner size="large" />
            </Stack>
          }
          extraData={extraData}
        />
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={`${intl.formatMessage({
            id: ETranslations.global_confirm,
          })}${totalCountEstimate}`}
          confirmButtonProps={{
            disabled: (() => {
              if (isLoading) {
                return true;
              }
              if (totalCount <= 0) {
                return true;
              }
              return false;
            })(),
          }}
          onConfirm={async () => {
            if (!deriveType) {
              return;
            }

            let advancedParams:
              | IBatchBuildAccountsAdvancedFlowParams
              | undefined;
            let normalParams: IBatchBuildAccountsNormalFlowParams | undefined;
            if (isAdvancedMode) {
              advancedParams = {
                walletId,
                networkId,
                deriveType,
                fromIndex: beginIndex,
                toIndex: endIndex,
                excludedIndexes: advanceExcludedIndexes,
                saveToDb: true,
                hideCheckingDeviceLoading: true,
                showUIProgress: true,
              };
            } else {
              normalParams = {
                walletId,
                networkId,
                deriveType,
                indexes: Object.entries(normalSelectedIndexes)
                  .filter(([, v]) => v)
                  .map(([k]) => parseInt(k, 10)),
                saveToDb: true,
                hideCheckingDeviceLoading: true,
                showUIProgress: true,
              };
            }
            if (!normalParams && !advancedParams) {
              throw new Error(
                'startBatchCreateAccountsFlow params is undefined',
              );
            }

            showBatchCreateAccountProcessingDialog({
              navigation,
            });
            await timerUtils.wait(600);

            const result =
              await backgroundApiProxy.serviceBatchCreateAccount.startBatchCreateAccountsFlow(
                isAdvancedMode
                  ? {
                      mode: 'advanced',
                      saveToCache: true,
                      params: checkIsDefined(advancedParams),
                    }
                  : {
                      mode: 'normal',
                      saveToCache: true,
                      params: checkIsDefined(normalParams),
                    },
              );

            if (result?.accountsForCreate) {
              setEditMode(false);
            }
          }}
        >
          <Stack
            $gtMd={{
              mr: '$3',
              flex: 1,
            }}
            $md={{
              mb: '$3',
            }}
            flexDirection="row"
            alignItems="center"
          >
            <Stack>
              <Checkbox
                onChange={(val) => {
                  selectCheckBox({
                    val,
                    accountsToSelect: accounts,
                  });
                }}
                label={intl.formatMessage({
                  // selectAll
                  id: ETranslations.global_generate_amount_select,
                })}
                value={(() => {
                  const notExistAccounts = accounts.filter(
                    (account) => !account.existsInDb,
                  );

                  if (notExistAccounts.length === 0) {
                    return 'indeterminate';
                  }

                  // advanced mode
                  if (isAdvancedMode) {
                    const excludedAccounts = notExistAccounts.filter(
                      (account) =>
                        advanceExcludedIndexes?.[account.pathIndex ?? -1] ===
                        true,
                    );
                    if (excludedAccounts.length === 0) {
                      return true;
                    }
                    if (excludedAccounts.length === notExistAccounts.length) {
                      return false;
                    }
                    return 'indeterminate';
                  }

                  // normal mode
                  const selectedAccounts = notExistAccounts.filter(
                    (account) =>
                      normalSelectedIndexes[account.pathIndex ?? -1] === true,
                  );
                  if (selectedAccounts.length === 0) {
                    return false;
                  }
                  if (selectedAccounts.length === notExistAccounts.length) {
                    return true;
                  }
                  return 'indeterminate';
                })()}
              />
            </Stack>
            <Stack flex={1} />
            <IconButton
              icon="SliderThreeOutline"
              mr="$3"
              borderRadius="$2"
              onPress={async () => {
                showBatchCreateAccountPreviewAdvancedDialog({
                  networkId,
                  defaultFrom: from,
                  defaultCount: count,
                  defaultDeriveType: deriveType,
                  async onSubmit(values) {
                    if (values) enableAdvancedMode(values);
                  },
                });
              }}
            />
            <ButtonGroup disabled={isLoading}>
              <ButtonGroup.Item
                testID="batch-create-account-preview-page-prev"
                opacity={1}
                onPress={() => {
                  setPageNumber(Math.max(1, page - 1));
                }}
                maxWidth={42}
                disabled={page < 2}
              >
                <Icon
                  name="ChevronLeftSmallOutline"
                  ml="$1"
                  size="$5"
                  style={
                    platformEnv.isNative
                      ? undefined
                      : {
                          transform: 'scale(1.4)',
                        }
                  }
                  opacity={page < 2 || isLoading ? 0.5 : undefined}
                />
              </ButtonGroup.Item>
              <ButtonGroup.Item
                testID="batch-create-account-preview-page-number"
                opacity={1}
                onPress={() => {
                  showBatchCreateAccountPreviewPageNumberDialog({
                    page,
                    confirmButtonProps: {
                      testID:
                        'batch-create-account-preview-page-number-confirm-button',
                    },
                    onSubmit: async (values) => {
                      if (!isNil(values?.page)) {
                        setPageNumber(values.page);
                      }
                    },
                  });
                }}
              >
                <Stack height={38} justifyContent="center">
                  <SizableText
                    lineHeight={38}
                    opacity={isLoading ? 0.5 : undefined}
                    size="$bodyLgMedium"
                  >
                    {page}
                  </SizableText>
                </Stack>
              </ButtonGroup.Item>
              <ButtonGroup.Item
                testID="batch-create-account-preview-page-next"
                opacity={1}
                onPress={() => {
                  setPageNumber(page + 1);
                }}
                maxWidth={42}
              >
                <Icon
                  style={
                    platformEnv.isNative
                      ? undefined
                      : {
                          transform: 'scale(1.4)',
                        }
                  }
                  name="ChevronRightSmallOutline"
                  mr="$1"
                  opacity={isLoading ? 0.5 : undefined}
                />
              </ButtonGroup.Item>
            </ButtonGroup>
          </Stack>
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
}

export default function BatchCreateAccountPreview({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.BatchCreateAccountPreview
>) {
  const { walletId, networkId: defaultNetworkId, from, count } = route.params;
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <BatchCreateAccountPreviewPage
        walletId={walletId}
        defaultNetworkId={defaultNetworkId}
        defaultCount={count}
        defaultFrom={from}
      />
    </AccountSelectorProviderMirror>
  );
}
