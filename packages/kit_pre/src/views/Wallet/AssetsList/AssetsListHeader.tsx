import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Box, Divider, Typography } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
  useOverviewLoading,
} from '../../../hooks';
import { ManageTokenModalRoutes } from '../../../routes/routesEnum';
import { showHomeBalanceSettings } from '../../Overlay/HomeBalanceSettings';
import { HomeTabActionHeader } from '../HomeTabActionHeader';
import { HomeTabAssetsHeader } from '../HomeTabAssetsHeader';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

const OverviewTokenListColumns = memo(() => {
  const intl = useIntl();
  return (
    <Box flexDirection="row" w="full">
      <Typography.Subheading color="text-subdued" flex={1}>
        {intl.formatMessage({ id: 'title__assets' })}
      </Typography.Subheading>
      <Typography.Subheading color="text-subdued" flex={1} textAlign="right">
        {intl.formatMessage({ id: 'content__price_uppercase' })}
      </Typography.Subheading>
      <Typography.Subheading color="text-subdued" flex={1} textAlign="right">
        {intl.formatMessage({ id: 'form__value' })}
      </Typography.Subheading>
    </Box>
  );
});

OverviewTokenListColumns.displayName = 'OverviewTokenListColumns';

const AssetsListHeaderInner: FC<{
  showTokenCount?: boolean;
  showRoundTop?: boolean;
  borderColor?: string;
  tokenEnabled?: boolean;
}> = ({
  showTokenCount,
  showRoundTop,
  borderColor = 'border-subdued',
  tokenEnabled,
}) => {
  const { account, network, networkId, accountId } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();

  const stats = useAppSelector(
    (s) => s.overview.overviewStats?.[networkId]?.[accountId],
  );

  const accountTokensValue = stats?.tokens?.totalValue;

  const shareRate = useMemo(
    () => new BigNumber(stats?.summary?.shareTokens ?? 0).times(100),
    [stats?.summary?.shareTokens],
  );

  const extraInfo = useMemo(() => {
    let extraIcon: ICON_NAMES | undefined;
    let extraLabel = '';
    let onExtraPress: (() => void) | undefined;
    if (showTokenCount) {
      extraIcon = 'ChevronRightMini';
      extraLabel = stats?.tokens?.totalCounts?.toString() ?? '0';
    } else if (tokenEnabled && !isAllNetworks(networkId)) {
      extraIcon = 'PlusMini';
      onExtraPress = () =>
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.ManageToken,
          params: { screen: ManageTokenModalRoutes.Listing },
        });
    }

    return {
      extraIcon,
      extraLabel,
      onExtraPress,
    };
  }, [
    navigation,
    networkId,
    showTokenCount,
    stats?.tokens?.totalCounts,
    tokenEnabled,
  ]);

  const onPress = useMemo(
    () =>
      showTokenCount
        ? () => {
            navigation.navigate(HomeRoutes.FullTokenListScreen, {
              accountId: account?.id,
              networkId: network?.id,
            });
          }
        : undefined,
    [account?.id, navigation, network?.id, showTokenCount],
  );

  return (
    <HomeTabAssetsHeader
      icon="DatabaseOutline"
      title={intl.formatMessage({ id: 'asset__tokens' })}
      usdFiatValue={accountTokensValue}
      shareRate={shareRate}
      extraIcon={extraInfo.extraIcon}
      extraLabel={extraInfo.extraLabel}
      onExtraPress={extraInfo.onExtraPress}
      showRoundTop={showRoundTop}
      borderColor={borderColor}
      onPress={onPress}
      columns={<OverviewTokenListColumns />}
    />
  );
};

function AssetsListHeaderOuter({
  networkId,
  accountId,
  tokenEnabled,
}: {
  networkId: string;
  accountId: string;
  tokenEnabled: boolean;
}) {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const loading = useOverviewLoading({
    networkId,
    accountId,
  });
  const refresh = useCallback(() => {
    backgroundApiProxy.serviceOverview.refreshCurrentAccount({
      debounceEnabled: false,
    });
  }, []);
  const showSettings = useCallback(
    () => showHomeBalanceSettings({ networkId }),
    [networkId],
  );
  const goToTokenManagement = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: { screen: ManageTokenModalRoutes.Listing },
    });
  }, [navigation]);

  return (
    <HomeTabActionHeader
      title={intl.formatMessage({ id: 'title__assets' })}
      loading={loading}
      onClickRefresh={refresh}
      onClickAdd={
        isAllNetworks(networkId) || !tokenEnabled
          ? undefined
          : goToTokenManagement
      }
      onClickSettings={showSettings}
    />
  );
}

const AssetsListHeader: FC<{
  showInnerHeader?: boolean;
  showOuterHeader?: boolean;
  showTokenCount?: boolean;
  showInnerHeaderRoundTop?: boolean;
  innerHeaderBorderColor?: string;
}> = ({
  showInnerHeader,
  showTokenCount,
  showOuterHeader,
  showInnerHeaderRoundTop,
  innerHeaderBorderColor,
}) => {
  const { network, wallet, accountId, networkId } = useActiveWalletAccount();
  const { tokenEnabled: networkTokenEnabled, activateTokenRequired } =
    network?.settings ?? { tokenEnabled: false, activateTokenRequired: false };

  const tokenEnabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && activateTokenRequired) {
      return false;
    }
    return networkTokenEnabled;
  }, [activateTokenRequired, networkTokenEnabled, wallet?.type]);

  return (
    <>
      {showOuterHeader ? (
        <AssetsListHeaderOuter
          accountId={accountId}
          networkId={networkId}
          tokenEnabled={tokenEnabled}
        />
      ) : null}

      {showInnerHeader && (
        <>
          <AssetsListHeaderInner
            borderColor={innerHeaderBorderColor}
            showRoundTop={showInnerHeaderRoundTop}
            showTokenCount={showTokenCount}
            tokenEnabled={tokenEnabled}
          />
          <Divider />
        </>
      )}
    </>
  );
};
AssetsListHeader.displayName = 'AssetsListHeader';

export default memo(AssetsListHeader);
