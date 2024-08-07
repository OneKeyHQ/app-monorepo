import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type {
  ICheckedState,
  IPageScreenProps,
  ISizableTextProps,
} from '@onekeyhq/components';
import {
  Button,
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

  const deriveTypeTrigger = useMemo(
    () => (
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
      >
        <Icon name="BranchesOutline" color="$iconSubdued" size="$6" />
      </XStack>
    ),
    [],
  );

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
          await backgroundApiProxy.serviceBatchCreateAccount.batchBuildAccounts(
            {
              walletId,
              networkId,
              deriveType,
              indexes,
              saveToDb: false,
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
    ({ account }: { account: INetworkAccount }) =>
      `${networkId}--${account.address}--${(account as IDBUtxoAccount).xpub}`,
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
        {/* {isLoading ? <Spinner mr="$4" size="small" /> : null} */}

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
            renderTrigger={deriveTypeTrigger}
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
          renderTrigger={({ label }) => deriveTypeTrigger}
        />

        <ControlledNetworkSelectorTrigger
          value={networkId}
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
      deriveTypeTrigger,
      intl,
      media.gtMd,
      networkId,
      showPopoverDeriveTypeInfo,
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
          return (
            <Checkbox
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
          <YStack>
            <SizableText size="$bodyMd">
              {accountUtils.shortenAddress({
                address: account.address,
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
            numberOfLines={10}
            style={{
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
      advanceExcludedIndexes,
      balanceMap,
      buildBalanceMapKey,
      buildRelPathSuffix,
      intl,
      isAdvancedMode,
      network?.symbol,
      normalSelectedIndexes,
      selectCheckBox,
    ],
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
          rowProps={{
            gap: '$4',
            px: '$5',
          }}
          dataSource={isLoading ? [] : accounts}
          columns={columns as any}
          TableEmptyComponent={
            <Stack
              py="$20"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
            >
              <Spinner size="large" />
            </Stack>
          }
          extraData={selectedIndexesCount}
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

            await backgroundApiProxy.serviceBatchCreateAccount.startBatchCreateAccountsFlow(
              isAdvancedMode
                ? {
                    mode: 'advanced',
                    params: checkIsDefined(advancedParams),
                  }
                : {
                    mode: 'normal',
                    params: checkIsDefined(normalParams),
                  },
            );
          }}
        >
          <Stack
            $gtMd={{
              mr: '$4',
              flex: 1,
            }}
            $md={{
              mb: '$4',
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
              mr="$4"
              radiused={false} // not working
              circular={false} // not working
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
            <ButtonGroup
              disabled={isLoading}
              items={[
                {
                  onPress: () => {
                    setPageNumber(Math.max(1, page - 1));
                  },
                  element: <Icon name="ChevronLeftOutline" pl="$1" />,
                },
                {
                  onPress: () => {
                    showBatchCreateAccountPreviewPageNumberDialog({
                      page,
                      onSubmit: async (values) => {
                        if (!isNil(values?.page)) {
                          setPageNumber(values.page);
                        }
                      },
                    });
                  },
                  element: (
                    <SizableText size="$bodyLgMedium">{page}</SizableText>
                  ),
                },
                {
                  onPress: () => {
                    setPageNumber(page + 1);
                  },
                  element: <Icon name="ChevronRightOutline" pr="$1" />,
                },
              ]}
            />
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
