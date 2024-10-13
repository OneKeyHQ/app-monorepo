import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IActionListSection, IListViewProps } from '@onekeyhq/components';
import {
  ActionList,
  Page,
  Spinner,
  Stack,
  Tab,
  getFontToken,
  useClipboard,
  useThemeValue,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { openTokenDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IToken } from '@onekeyhq/shared/types/token';

import TokenDetailsViews from './TokenDetailsView';

import type { RouteProp } from '@react-navigation/core';

const num = 0;

export type IProps = {
  accountId: string;
  networkId: string;
  walletId: string;
  deriveInfo: IAccountDeriveInfo;
  deriveType: IAccountDeriveTypes;
  tokenInfo: IToken;
  isBlocked?: boolean;
  riskyTokens?: string[];
  isAllNetworks?: boolean;
  listViewContentContainerStyle?: IListViewProps<IAccountHistoryTx>['contentContainerStyle'];
  indexedAccountId?: string;
};

function TokenDetails() {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.TokenDetails
      >
    >();

  const { copyText } = useClipboard();

  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
  } = route.params;

  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
    walletId,
  });

  const headerRight = useCallback(() => {
    const sections: IActionListSection[] = [];

    if (!tokenInfo.isNative) {
      sections.push({
        items: [
          {
            label: intl.formatMessage({
              id: ETranslations.global_copy_token_contract,
            }),
            icon: 'Copy3Outline',
            onPress: () => copyText(tokenInfo.address),
          },
        ],
      });

      if (network?.id && tokenInfo.address) {
        sections[0].items.push({
          label: intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          }),
          icon: 'OpenOutline',
          onPress: () =>
            openTokenDetailsUrl({
              networkId: network.id,
              tokenAddress: tokenInfo.address,
            }),
        });
      }
    }

    return isEmpty(sections) ? null : (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_more })}
        renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
        sections={sections}
      />
    );
  }, [copyText, intl, network, tokenInfo.address, tokenInfo.isNative]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId,
            indexedAccountId: account?.indexedAccountId ?? '',
          },
        );
      await waitAsync(600);
      return r;
    },
    [networkId, account?.indexedAccountId],
    {
      watchLoading: true,
    },
  );

  const fontColor = useThemeValue('text');

  const headerTitleStyle = useMemo(
    () => ({
      ...(getFontToken('$headingLg') as {
        fontSize: number;
        lineHeight: number;
        letterSpacing: number;
      }),
      color: fontColor,
    }),
    [fontColor],
  );

  const tabs = useMemo(() => {
    if (accountId && networkId && walletId) {
      return result?.networkAccounts.map((item) => ({
        title: item.deriveInfo.labelKey
          ? intl.formatMessage({ id: item.deriveInfo.labelKey })
          : item.deriveInfo.label ?? '',
        page: () => (
          <TokenDetailsViews
            accountId={item.account?.id ?? ''}
            networkId={networkId}
            walletId={walletId}
            deriveInfo={item.deriveInfo}
            deriveType={item.deriveType}
            tokenInfo={tokenInfo}
            isAllNetworks={isAllNetworks}
            listViewContentContainerStyle={{ pt: '$5' }}
            indexedAccountId={account?.indexedAccountId}
          />
        ),
      }));
    }

    return [];
  }, [
    accountId,
    networkId,
    walletId,
    result?.networkAccounts,
    intl,
    tokenInfo,
    isAllNetworks,
    account?.indexedAccountId,
  ]);

  const renderTokenDetailsView = useCallback(() => {
    if (
      vaultSettings?.mergeDeriveAssetsEnabled &&
      isAllNetworks &&
      !accountUtils.isOthersWallet({ walletId })
    ) {
      if (isLoading)
        return (
          <Stack
            flex={1}
            height="100%"
            alignItems="center"
            justifyContent="center"
          >
            <Spinner size="large" />
          </Stack>
        );
      if (tabs && !isEmpty(tabs)) {
        return (
          <Tab.Page
            data={tabs}
            initialScrollIndex={0}
            showsVerticalScrollIndicator={false}
          />
        );
      }
      return null;
    }

    return (
      <TokenDetailsViews
        accountId={accountId}
        networkId={networkId}
        walletId={walletId}
        deriveInfo={deriveInfo}
        deriveType={deriveType}
        tokenInfo={tokenInfo}
        isAllNetworks={isAllNetworks}
        indexedAccountId={account?.indexedAccountId}
        listViewContentContainerStyle={{ pt: '$5' }}
      />
    );
  }, [
    accountId,
    deriveInfo,
    deriveType,
    isAllNetworks,
    isLoading,
    networkId,
    tabs,
    tokenInfo,
    vaultSettings?.mergeDeriveAssetsEnabled,
    walletId,
    account,
  ]);

  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header
        headerTitle={tokenInfo.name}
        headerTitleStyle={headerTitleStyle}
        headerRight={headerRight}
      />
      <Page.Body>{renderTokenDetailsView()}</Page.Body>
    </Page>
  );
}

export default function TokenDetailsModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <TokenDetails />
    </AccountSelectorProviderMirror>
  );
}
