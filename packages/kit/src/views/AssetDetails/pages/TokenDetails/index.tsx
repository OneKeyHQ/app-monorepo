/* eslint-disable react/no-unstable-nested-components */
import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IActionListSection,
  IListViewProps,
  ISectionListProps,
  IStackProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Page,
  Spinner,
  Stack,
  Tabs,
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
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';

import {
  TokenDetailsContext,
  useTokenDetailsContext,
} from './TokenDetailsContext';
import TokenDetailsFooter from './TokenDetailsFooter';
import TokenDetailsViews from './TokenDetailsView';

import type { ITokenDetailsContextValue } from './TokenDetailsContext';
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
  isTabView?: boolean;
  listViewContentContainerStyle?: IListViewProps<IAccountHistoryTx>['contentContainerStyle'];
  indexedAccountId?: string;
  inTabList?: boolean;
  ListHeaderComponent?: ISectionListProps<any>['ListHeaderComponent'];
} & IStackProps;
function TokenDetailsView() {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.TokenDetails
      >
    >();

  const { copyText } = useClipboard();
  const { updateTokenMetadata } = useTokenDetailsContext();

  const {
    accountId,
    networkId,
    walletId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
    indexedAccountId,
  } = route.params;

  const { network, vaultSettings } = useAccountData({
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
            indexedAccountId,
          },
        );
      await waitAsync(600);
      return r;
    },
    [networkId, indexedAccountId],
    {
      watchLoading: true,
    },
  );

  usePromiseResult(async () => {
    const resp = await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
      networkId,
      contractList: [tokenInfo.address],
    });
    updateTokenMetadata({
      price: resp[0]?.price ?? 0,
      priceChange24h: resp[0]?.price24h ?? 0,
      coingeckoId: resp[0]?.info?.coingeckoId ?? '',
    });
  }, [networkId, tokenInfo.address, updateTokenMetadata]);

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

  const listViewContentContainerStyle = useMemo(() => ({ pt: '$5' }), []);
  const tabs = useMemo(() => {
    if (networkId && walletId) {
      return result?.networkAccounts.map((item, index) => (
        <Tabs.Tab
          key={String(index)}
          name={
            item.deriveInfo.labelKey
              ? intl.formatMessage({ id: item.deriveInfo.labelKey })
              : item.deriveInfo.label ?? String(index)
          }
        >
          <TokenDetailsViews
            inTabList
            isTabView
            accountId={item.account?.id ?? ''}
            networkId={networkId}
            walletId={walletId}
            deriveInfo={item.deriveInfo}
            deriveType={item.deriveType}
            tokenInfo={tokenInfo}
            isAllNetworks={isAllNetworks}
            listViewContentContainerStyle={listViewContentContainerStyle}
            indexedAccountId={indexedAccountId}
          />
        </Tabs.Tab>
      ));
    }

    return [];
  }, [
    networkId,
    walletId,
    result?.networkAccounts,
    intl,
    tokenInfo,
    isAllNetworks,
    listViewContentContainerStyle,
    indexedAccountId,
  ]);

  const tokenDetailsViewElement = useMemo(() => {
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
    if (
      vaultSettings?.mergeDeriveAssetsEnabled &&
      !accountUtils.isOthersWallet({ walletId })
    ) {
      if (tabs && !isEmpty(tabs) && tabs.length > 1) {
        return (
          <Tabs.Container
            renderTabBar={(props) => <Tabs.TabBar {...props} scrollable />}
          >
            {tabs}
          </Tabs.Container>
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
        indexedAccountId={indexedAccountId}
        listViewContentContainerStyle={listViewContentContainerStyle}
      />
    );
  }, [
    isLoading,
    vaultSettings?.mergeDeriveAssetsEnabled,
    walletId,
    accountId,
    networkId,
    deriveInfo,
    deriveType,
    tokenInfo,
    isAllNetworks,
    indexedAccountId,
    listViewContentContainerStyle,
    tabs,
  ]);

  return (
    <Page lazyLoad safeAreaEnabled={false}>
      <Page.Header
        headerTitle={tokenInfo.name}
        headerTitleStyle={headerTitleStyle}
        headerRight={headerRight}
      />
      <Page.Body>{tokenDetailsViewElement}</Page.Body>
      <TokenDetailsFooter networkId={networkId} />
    </Page>
  );
}

const TokenDetails = memo(TokenDetailsView);

export default function TokenDetailsModal() {
  // Context state
  const [tokenMetadata, setTokenMetadata] =
    useState<ITokenDetailsContextValue['tokenMetadata']>();

  const [tokenDetails, setTokenDetails] = useState<
    ITokenDetailsContextValue['tokenDetails']
  >({});

  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState<
    ITokenDetailsContextValue['isLoadingTokenDetails']
  >({});

  const updateTokenMetadata = useCallback(
    (data: Partial<ITokenDetailsContextValue['tokenMetadata']>) => {
      setTokenMetadata((prev) => ({
        ...prev,
        ...data,
      }));
    },
    [],
  );

  const updateIsLoadingTokenDetails = useCallback(
    ({ accountId, isLoading }: { accountId: string; isLoading: boolean }) => {
      setIsLoadingTokenDetails((prev) => ({
        ...prev,
        [accountId]: isLoading,
      }));
    },
    [],
  );

  const updateTokenDetails = useCallback(
    ({
      accountId,
      isInit,
      data,
    }: {
      accountId: string;
      isInit: boolean;
      data: IFetchTokenDetailItem;
    }) => {
      setTokenDetails((prev) => ({
        ...prev,
        [accountId]: { init: isInit, data },
      }));
    },
    [],
  );

  // Context value
  const contextValue = useMemo(
    () => ({
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
    }),
    [
      tokenMetadata,
      updateTokenMetadata,
      isLoadingTokenDetails,
      updateIsLoadingTokenDetails,
      tokenDetails,
      updateTokenDetails,
    ],
  );
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <TokenDetailsContext.Provider value={contextValue}>
        <TokenDetails />
      </TokenDetailsContext.Provider>
    </AccountSelectorProviderMirror>
  );
}
