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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IBatchBuildAccountsAdvancedFlowParams,
  IBatchBuildAccountsNormalFlowParams,
} from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IBatchCreateAccount,
  INetworkAccount,
} from '@onekeyhq/shared/types/account';
import type { IFetchAccountDetailsResp } from '@onekeyhq/shared/types/address';

import { BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT } from './BatchCreateAccountFormBase';
import { showBatchCreateAccountPreviewAdvancedDialog } from './showBatchCreateAccountPreviewAdvancedDialog';
import { showBatchCreateAccountPreviewPageNumberDialog } from './showBatchCreateAccountPreviewPageNumberDialog';

import type { IBatchCreateAccountFormValues } from './BatchCreateAccountFormBase';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  from: string;
  count: string;
};

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
    return 2 ** 32 - 1 - fromInt;
  }, [count, fromInt, isAdvancedMode]);
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
            id: ETranslationsMock.batch_create_page_number_invalid,
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
      setIsAdvancedMode(true);
      setAdvancedExcludedIndexes({});
      setNormalSelectedIndexes({});
      setFrom(values.from);
      setCount(values.count);
      setDeriveType(values.deriveType);
      setPage(minPage);
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
            newValue[a.pathIndex ?? -1] = !!val;
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

        <Button
          variant="tertiary"
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
            {intl.formatMessage({
              id: ETranslations.global_advanced,
            })}
            <Stack pl="$4">
              <ListItem.DrillIn name="ChevronDownSmallSolid" />
            </Stack>
          </XStack>
        </Button>

        <DeriveTypeSelectorTriggerStaticInput
          value={deriveType}
          onChange={(v) => setDeriveType(v)}
          networkId={networkId || ''}
          defaultTriggerInputProps={{
            size: media.gtMd ? 'medium' : 'large',
          }}
          renderTrigger={({ label }) => (
            <ListItem
              userSelect="none"
              // title={title}
              // avatarProps={{ src: icon, size: '$8' }}
            >
              <XStack>
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

  const totalCountEstimate = useMemo(() => {
    if (!isAdvancedMode && selectedIndexesCount > 0) {
      return ` (${selectedIndexesCount})`;
    }
    if (isAdvancedMode) {
      return ` (${
        countInt - Object.values(advanceExcludedIndexes).filter(Boolean).length
      })`;
    }
    return '';
  }, [advanceExcludedIndexes, countInt, isAdvancedMode, selectedIndexesCount]);

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.send_preview_button,
        })}
        dismissOnOverlayPress={false}
        headerRight={headerRight}
      />
      <Page.Body p="$4">
        <Stack flexDirection="row">
          <SizableText w="80px" pr="$4" wordWrap="break-word">
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_number,
            })}
            {/* TestVeryLongWordTestVeryLongWordTestVeryLongWord */}
          </SizableText>
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_address,
            })}
          </SizableText>
          <Stack flex={1}> </Stack>
          <SizableText>
            {intl.formatMessage({
              id: ETranslations.global_generate_amount_balance,
            })}
          </SizableText>
        </Stack>

        {isLoading ? (
          <Stack py="$8">
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
                <Stack w="80px" pr="$4">
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
                      wordWrap: 'break-word', // TODO not working
                    }}
                  />
                </Stack>

                <Stack pr="$4" flex={1}>
                  <SizableText>
                    {accountUtils.shortenAddress({
                      address: account.address,
                    })}
                  </SizableText>
                  <SizableText>
                    {account.path}
                    {account.relPath || ''}
                  </SizableText>
                </Stack>
                <NumberSizeableText
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
              if (!isAdvancedMode && selectedIndexesCount <= 0) {
                return true;
              }
              return false;
            })(),
          }}
          onConfirm={async () => {
            if (!deriveType) {
              return;
            }
            void navigation.navigate(
              EAccountManagerStacksRoutes.BatchCreateAccountProcessing,
              undefined,
            );

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
            }}
            $md={{
              mb: '$4',
            }}
            flex={1}
            flexDirection="row"
            alignItems="center"
          >
            <Stack>
              <Checkbox
                value={(() => {
                  const notExistAccounts = accounts.filter(
                    (account) => !account.existsInDb,
                  );

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
