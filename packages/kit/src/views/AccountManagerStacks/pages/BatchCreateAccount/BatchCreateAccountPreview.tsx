import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { ICheckedState, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  IconButton,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IBatchBuildAccountsAdvancedFlowParams,
  IBatchBuildAccountsNormalFlowParams,
} from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
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
  networkId,
  defaultFrom,
  defaultCount,
  defaultIsAdvancedMode,
}: {
  walletId: string;
  networkId: string;
  defaultFrom: string; // start from 1
  defaultCount: string;
  defaultIsAdvancedMode?: boolean;
}) {
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
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );
  const [balanceMap, setBalanceMap] = useState<{
    [key: string]: string | undefined;
  }>({});
  const balanceMapRef = useRef(balanceMap);
  balanceMapRef.current = balanceMap;

  const { result: accounts = [], isLoading } = usePromiseResult(
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
          navigation.pop();
        }
        throw error;
      }
    },
    [deriveType, endIndex, fromInt, navigation, networkId, page, walletId],
    {
      watchLoading: true,
      debounced: 300,
    },
  );

  const buildBalanceMapKey = useCallback(
    ({ account }: { account: INetworkAccount }) =>
      `${networkId}--${account.address}--${(account as IDBUtxoAccount).xpub}`,
    [networkId],
  );

  useEffect(() => {
    void (async () => {
      const toFetchBalanceAccounts = [];
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
            const balances: IFetchAccountDetailsResp =
              await backgroundApiProxy.serviceAccountProfile.fetchAccountInfo({
                accountId: account?.id || '',
                networkId,
                accountAddress: account?.address,
                xpub: (account as IDBUtxoAccount)?.xpub,
                withNetWorth: true,
              });
            // Process the balances here
            balancesToUpdate[buildBalanceMapKey({ account })] =
              balances.balanceParsed;
          }),
        );

        if (Object.keys(balancesToUpdate).length) {
          setBalanceMap((v) => {
            const newValue = { ...v, ...balancesToUpdate };
            return newValue;
          });
        }
      }
    })();
  }, [accounts, buildBalanceMapKey, networkId]);

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

        <ListItem
          ml="$4"
          // variant="tertiary"
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
        >
          <XStack alignItems="center">
            <SizableText mr="$3">
              {intl.formatMessage({
                id: ETranslations.global_advanced,
              })}
            </SizableText>
            <ListItem.DrillIn name="ChevronDownSmallSolid" />
          </XStack>
        </ListItem>

        <DeriveTypeSelectorTriggerStaticInput
          hideIfItemsLTEOne
          value={deriveType}
          onChange={(v) => {
            if (deriveType !== v) {
              setDeriveType(v);
            }
          }}
          networkId={networkId || ''}
          defaultTriggerInputProps={{
            size: media.gtMd ? 'medium' : 'large',
          }}
          renderTrigger={({ label }) => (
            <ListItem
              pr={0}
              // ml="$4"
              // variant="tertiary"
              // title={title}
              // avatarProps={{ src: icon, size: '$8' }}
            >
              <XStack alignItems="center">
                <SizableText mr="$3">{label}</SizableText>
                <ListItem.DrillIn name="ChevronDownSmallSolid" />
              </XStack>
            </ListItem>
          )}
        />
      </Stack>
    ),
    [count, deriveType, enableAdvancedMode, from, intl, media.gtMd, networkId],
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

  const numWidth = '$20';

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.send_preview_button,
        })}
        dismissOnOverlayPress={false}
        headerRight={headerRight}
      />
      <Page.Body
        px="$5"
        // backgroundColor={'#eee'}
      >
        <Stack flexDirection="row" py="$2">
          <SizableText
            size="$bodyMd"
            w={numWidth}
            pr="$4"
            wordWrap="break-word"
          >
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_number,
            })}
            {/* TestVeryLongWordTestVeryLongWordTestVeryLongWord */}
          </SizableText>
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_address,
            })}
          </SizableText>
          <Stack flex={1} />
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_balance,
            })}
          </SizableText>
        </Stack>

        {isLoading ? (
          <Stack
            py="$20"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            <Spinner size="large" />
          </Stack>
        ) : (
          accounts.map((account) => {
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
              <Stack
                key={account.id}
                flexDirection="row"
                alignItems="center"
                py="$1"
              >
                <Stack w={numWidth} pr="$4">
                  <Checkbox
                    disabled={account.existsInDb}
                    value={checkedState}
                    onChange={(val) => {
                      selectCheckBox({
                        val,
                        accountsToSelect: [account],
                      });
                    }}
                    label={String((account.pathIndex ?? 0) + 1)}
                    labelProps={{
                      size: '$bodyMd',
                      wordWrap: 'break-word', // TODO not working
                    }}
                  />
                </Stack>

                <Stack pr="$4" flex={1}>
                  <SizableText size="$bodyMd">
                    {accountUtils.shortenAddress({
                      address: account.address,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {account.path}
                    {account.relPath || ''}
                  </SizableText>
                </Stack>
                <NumberSizeableText
                  size="$bodyMd"
                  formatter="balance"
                  formatterOptions={{ tokenSymbol: network?.symbol }}
                >
                  {balanceMap[buildBalanceMapKey({ account })] ?? '-'}
                </NumberSizeableText>
              </Stack>
            );
          })
        )}
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
              icon="ChevronLeftOutline"
              disabled={page <= minPage || isLoading}
              onPress={() => {
                setPageNumber(Math.max(1, page - 1));
              }}
            />
            <Button
              onPress={() => {
                showBatchCreateAccountPreviewPageNumberDialog({
                  page,
                  onSubmit: async (values) => {
                    if (!isNil(values?.page)) {
                      setPageNumber(values.page);
                    }
                  },
                });
              }}
              disabled={isLoading}
              variant="tertiary"
              mx="$1"
              px="$4"
            >
              {page}
            </Button>
            <IconButton
              icon="ChevronRightOutline"
              disabled={page >= maxPage || isLoading}
              onPress={() => {
                setPageNumber(page + 1);
              }}
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
  const { walletId, networkId, from, count } = route.params;
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
        networkId={networkId}
        defaultCount={count}
        defaultFrom={from}
      />
    </AccountSelectorProviderMirror>
  );
}
