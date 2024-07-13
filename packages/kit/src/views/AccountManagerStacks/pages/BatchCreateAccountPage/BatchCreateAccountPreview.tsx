import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTriggerStaticInput } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';

import { ListItem } from '../../../../components/ListItem';

type IFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  from: string;
  count: string;
};

function BatchCreateAccountPreviewPage({
  walletId,
  networkId,
  from,
  count,
}: {
  walletId: string;
  networkId: string;
  from: string;
  count: string;
}) {
  const fromInt = parseInt(from, 10);
  const countInt = parseInt(count, 10);
  const [excludedIndexes, setExcludedIndexes] = useState<{
    [index: number]: true;
  }>({});
  const { activeAccount } = useActiveAccount({ num: 0 });
  const pageSize = 10;
  const minPage = 1;
  const [page, setPage] = useState(minPage);
  const maxPage = useMemo(() => Math.ceil(countInt / pageSize), [countInt]);
  const [deriveType, setDeriveType] = useState(
    activeAccount.deriveType ?? 'default',
  );
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();

  const setPageNumber = useCallback(
    (pageNumber: number) => {
      if (pageNumber < minPage) {
        return setPage(minPage);
      }
      if (pageNumber > maxPage) {
        return setPage(maxPage);
      }
      return setPage(pageNumber);
    },
    [maxPage],
  );

  const beginIndex = fromInt - 1;
  const endIndex = beginIndex + countInt - 1;

  const previewTimes = useRef(0);

  const { result: accounts = [], isLoading } = usePromiseResult(
    async () => {
      try {
        previewTimes.current += 1;
        const fromIndexInPage = fromInt - 1 + (page - 1) * pageSize;

        const toIndexInPage = Math.min(
          endIndex,
          fromIndexInPage + pageSize - 1,
        );

        const { accountsForCreate } =
          await backgroundApiProxy.serviceCreateBatchAccount.batchBuildAccounts(
            {
              walletId,
              networkId,
              deriveType,
              fromIndex: fromIndexInPage,
              toIndex: toIndexInPage,
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

  const selectCheckBox = useCallback(
    ({
      val,
      accountsToSelect,
    }: {
      val: ICheckedState;
      accountsToSelect: IBatchCreateAccount[];
    }) => {
      if (val === true) {
        setExcludedIndexes((v) => {
          for (const a of accountsToSelect) {
            if (!a.existsInDb) {
              delete v[a.pathIndex ?? -1];
            }
          }
          return { ...v };
        });
      }
      if (val === false) {
        setExcludedIndexes((v) => {
          const newValue = { ...v };
          for (const a of accountsToSelect) {
            if (!a.existsInDb) {
              newValue[a.pathIndex ?? -1] = true;
            }
          }
          return newValue;
        });
      }
    },
    [],
  );
  const headerRight = useCallback(
    () => (
      <Stack flexDirection="row" alignItems="center">
        {isLoading ? <Spinner mr="$4" size="small" /> : null}

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
    [deriveType, isLoading, media.gtMd, networkId],
  );

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header dismissOnOverlayPress={false} headerRight={headerRight} />
      <Page.Body p="$4">
        <Stack flexDirection="row">
          <Checkbox
            value={(() => {
              const notExistAccounts = accounts.filter(
                (account) => !account.existsInDb,
              );

              const excludedAccounts = notExistAccounts.filter(
                (account) =>
                  excludedIndexes?.[account.pathIndex ?? -1] === true,
              );

              if (excludedAccounts.length === 0) {
                return true;
              }
              if (excludedAccounts.length === notExistAccounts.length) {
                return false;
              }
              return 'indeterminate';
            })()}
            onChange={(val) => {
              selectCheckBox({
                val,
                accountsToSelect: accounts,
              });
            }}
            label="Select All"
          />
          <Stack flex={1}> </Stack>
          <SizableText>Balance</SizableText>
        </Stack>

        {
          // eslint-disable-next-line no-constant-condition
          false ? (
            <Spinner size="large" />
          ) : (
            accounts.map((account) => {
              const pathIndex = account.pathIndex ?? -1;
              let checkedState: ICheckedState = true;
              if (account.existsInDb) {
                checkedState = 'indeterminate';
              } else if (excludedIndexes?.[pathIndex] === true) {
                checkedState = false;
              }
              return (
                <Stack
                  key={account.id}
                  flexDirection="row"
                  alignItems="center"
                  py="$1"
                >
                  <Checkbox
                    disabled={account.existsInDb}
                    value={checkedState}
                    onChange={(val) => {
                      selectCheckBox({
                        val,
                        accountsToSelect: [account],
                      });
                    }}
                  />
                  <Stack px="$4">
                    <SizableText>{(account.pathIndex ?? 0) + 1}</SizableText>
                  </Stack>
                  <Stack flex={1}>
                    <SizableText>
                      {accountUtils.shortenAddress({
                        address: account.address,
                      })}
                    </SizableText>
                    <SizableText>{account.path}</SizableText>
                  </Stack>
                  <SizableText>0 ETH</SizableText>
                </Stack>
              );
            })
          )
        }

        <Stack flexDirection="row" alignItems="center">
          <Button
            disabled={page <= minPage || isLoading}
            onPress={() => {
              setPageNumber(Math.max(1, page - 1));
            }}
          >
            Prev
          </Button>
          <Stack px="$4">
            <SizableText>{page}</SizableText>
          </Stack>
          <Button
            disabled={page >= maxPage || isLoading}
            onPress={() => {
              setPageNumber(page + 1);
            }}
          >
            Next
          </Button>
          {isLoading ? <Spinner ml="$4" size="small" /> : null}
        </Stack>
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: isLoading,
        }}
        onConfirm={async () => {
          void navigation.navigate(
            EAccountManagerStacksRoutes.BatchCreateAccountProcessing,
            undefined,
          );
          await backgroundApiProxy.serviceCreateBatchAccount.startBatchCreateAccountsFlow(
            {
              walletId,
              networkId,
              deriveType,
              fromIndex: beginIndex,
              toIndex: endIndex,
              excludedIndexes,
              saveToDb: true,
            },
          );
        }}
      />
    </Page>
  );
}

export default function BatchCreateAccountPreview({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.BatchCreateAccountPreview
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <BatchCreateAccountPreviewPage {...route.params} />
    </AccountSelectorProviderMirror>
  );
}
