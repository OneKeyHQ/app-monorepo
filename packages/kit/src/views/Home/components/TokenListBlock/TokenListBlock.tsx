import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Skeleton, Stack, XStack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { EmptyAccount, EmptyToken } from '@onekeyhq/kit/src/components/Empty';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useTokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  useHomeSectionPayload,
  useHomeSectionSnapshot,
} from '../../model/react/homeStoreHooks';
import { RichBlock } from '../RichBlock/RichBlock';

function TokenListBlock({
  tableLayout,
}: {
  tableLayout?: boolean;
  showRecentHistory?: boolean;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    activeAccount: {
      account,
      accountName,
      deriveInfo,
      deriveType,
      indexedAccount,
      isOthersWallet,
      network,
      wallet,
    },
  } = useActiveAccount({ num: 0 });
  const portfolioSection = useHomeSectionSnapshot('portfolio');
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const [, setTokenSelectorFilter] = useTokenSelectorFilterPersistAtom();
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });

  const payload =
    portfolioSection.value.kind === 'ready' ? portfolioPayload : undefined;

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      setTokenSelectorFilter((previous) => ({
        ...previous,
        homeShowLpTokensOnly: value,
      }));
    },
    [setTokenSelectorFilter],
  );

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      if (!network || !wallet) {
        return;
      }
      const aggregateTokens =
        payload?.aggregateTokenListMap[token.$key]?.tokens ?? [];

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.TokenDetails,
        params: {
          accountId: token.accountId ?? account?.id ?? '',
          networkId: token.networkId ?? network.id,
          accountAddress: account?.address ?? '',
          walletId: wallet.id,
          isAllNetworks: network.isAllNetworks,
          indexedAccountId: indexedAccount?.id ?? '',
          tokenInfo: token,
          aggregateTokens,
          tokenMap: payload?.tapTokenMap ?? {},
        },
      });
    },
    [
      account?.address,
      account?.id,
      indexedAccount?.id,
      navigation,
      network,
      payload?.aggregateTokenListMap,
      payload?.tapTokenMap,
      wallet,
    ],
  );

  const subTitle = useMemo(() => {
    if (!tableLayout) {
      return null;
    }
    if (!payload) {
      return <Skeleton.HeadingLg />;
    }
    return (
      <Currency
        hideValue
        size="$headingXl"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={payload.accountTokensWorthCurrency}
      >
        {payload.accountTokensValue}
      </Currency>
    );
  }, [payload, tableLayout]);

  const headerActions = useMemo(() => {
    const filterSwitch = payload?.showLpTokenFilterSwitch ? (
      <TokenSelectorLpTokenSwitch
        value={payload.showLpTokensOnly}
        onChange={handleLpTokenFilterChange}
        loading={payload.isLpTokenSwitchLoading}
      />
    ) : null;
    if (!manageTokenEnabled || !tableLayout) {
      return filterSwitch;
    }
    return (
      <XStack alignItems="center" gap="$2">
        {filterSwitch}
        <IconButton
          testID="home-render-header-actions-icon-btn"
          title={intl.formatMessage({ id: ETranslations.manage_token_title })}
          variant="tertiary"
          icon="SliderHorOutline"
          onPress={handleOnManageToken}
          size="medium"
        />
      </XStack>
    );
  }, [
    handleLpTokenFilterChange,
    handleOnManageToken,
    intl,
    manageTokenEnabled,
    payload,
    tableLayout,
  ]);

  let content = (
    <Stack py="$3">
      <ListLoading listCount={6} />
    </Stack>
  );
  if (portfolioSection.value.kind === 'error') {
    content = <EmptyToken />;
  } else if (payload) {
    if (payload.displayIds.length === 0 && payload.isAllNetworkEmptyAccount) {
      content = (
        <Stack py="$20">
          <EmptyAccount
            createAllDeriveTypes
            createAllEnabledNetworks
            autoCreateAddress={false}
            name={accountName}
            chain={network?.name ?? ''}
            type={
              (deriveInfo?.labelKey
                ? intl.formatMessage({ id: deriveInfo.labelKey })
                : deriveInfo?.label) ?? ''
            }
          />
        </Stack>
      );
    } else {
      content = (
        <TokenListView
          limit={6}
          plainMode
          withHeader
          withFooter
          withPrice
          inTabList
          hideValue
          withSwapAction
          enableCellSeam
          homeStoreDisplayIds={payload.displayIds}
          hostNetworksMap={payload.networksMap}
          hostAggregateTokenListMap={payload.aggregateTokenListMap}
          showActiveAccountTokenList
          scopedActiveAccountTokenList={{
            keys: `${payload.ownerKey}:${payload.generation}`,
            tokens: payload.tokens,
          }}
          scopedActiveAccountTokenListState={{
            initialized: true,
            isRefreshing: false,
          }}
          scopedActiveAccountTokenListMap={payload.tokenListMap}
          hideDeFiMarkedTokens={!payload.showLpTokensOnly}
          accountId={account?.id ?? ''}
          networkId={network?.id ?? ''}
          indexedAccountId={indexedAccount?.id ?? ''}
          mergeDeriveAddressData={payload.mergeDeriveAddressData}
          allAggregateTokenMap={payload.allAggregateTokenMap}
          showNetworkIcon={!!network?.isAllNetworks}
          hideZeroBalanceTokens={
            payload.showLpTokensOnly ? false : !!network?.isAllNetworks
          }
          deferTokenManagement={!!network?.isAllNetworks}
          manageTokenEnabled={manageTokenEnabled}
          onManageToken={handleOnManageToken}
          onPressToken={handleOnPressToken}
          isAllNetworks={network?.isAllNetworks}
          homeDefaultTokenMap={payload.homeDefaultTokenMap}
          tableLayout={tableLayout}
          listViewStyleProps={{
            ListHeaderComponentStyle: { pt: '$3' },
          }}
        />
      );
    }
  }

  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      })}
      subTitle={subTitle}
      headerActions={headerActions}
      headerContainerProps={{ px: '$pagePadding' }}
      content={content}
      plainContentContainer
    />
  );
}

export { TokenListBlock };
