import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Spinner,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
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
import { FormatCurrencyNumber } from '../../../components/Format';
import {
  useAccountIsUpdating,
  useAccountTokenValues,
  useAccountTokens,
  useAccountValues,
  useActiveWalletAccount,
  useNavigation,
} from '../../../hooks';
import { ManageTokenModalRoutes } from '../../../routes/routesEnum';
import { showHomeBalanceSettings } from '../../Overlay/HomeBalanceSettings';
import { OverviewBadge } from '../../Overview/components/OverviewBadge';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type BigNumber from 'bignumber.js';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

const RefreshButton = memo(
  ({
    refreshing,
    onRefresh,
  }: {
    refreshing: boolean;
    onRefresh: () => void;
  }) => {
    const homeTabName = useAppSelector((s) => s.status.homeTabName);

    return (
      <Box alignItems="center" justifyContent="center" w="8" h="8" mr="3">
        {refreshing ? (
          <Spinner size="sm" key={homeTabName} />
        ) : (
          <IconButton
            onPress={onRefresh}
            size="sm"
            name="ArrowPathMini"
            type="plain"
            ml="auto"
          />
        )}
      </Box>
    );
  },
);
RefreshButton.displayName = 'RefreshButton';

const OuterHeader = memo(
  ({
    onNavigate,
    onShowHomeBalanceSettings,
    tokenEnabled,
    networkId,
    accountId,
  }: {
    onNavigate: () => void;
    onShowHomeBalanceSettings: () => void;
    tokenEnabled: boolean;
    networkId: string;
    accountId: string;
  }) => {
    const intl = useIntl();

    const loading = useAccountIsUpdating({
      networkId,
      accountId,
    });

    const refresh = useCallback(() => {
      backgroundApiProxy.serviceOverview.refreshCurrentAccount();
    }, []);

    return (
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'title__assets' })}
        </Typography.Heading>
        {tokenEnabled && (
          <HStack alignItems="center" justifyContent="flex-end">
            {isAllNetworks(networkId) ? null : (
              <RefreshButton refreshing={loading} onRefresh={refresh} />
            )}
            {isAllNetworks(networkId) ? null : (
              <IconButton
                onPress={onNavigate}
                size="sm"
                name="PlusMini"
                type="plain"
                ml="auto"
                mr={3}
              />
            )}
            <IconButton
              onPress={onShowHomeBalanceSettings}
              size="sm"
              name="Cog8ToothMini"
              type="plain"
              mr={-2}
            />
          </HStack>
        )}
      </Box>
    );
  },
);
OuterHeader.displayName = 'OuterHeader';

const TokenBalancesMemo = memo(
  ({ tokenAmount }: { tokenAmount: BigNumber }) => (
    <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
      {Number.isNaN(tokenAmount) || tokenAmount.isNaN() ? (
        ' '
      ) : (
        <FormatCurrencyNumber value={0} convertValue={tokenAmount} />
      )}
    </Text>
  ),
  (prevProps, nextProps) =>
    prevProps.tokenAmount.isEqualTo(nextProps.tokenAmount),
);
TokenBalancesMemo.displayName = 'TokenBalancesMemo';

const RateBadgeMemo = memo(
  ({ rate }: { rate: BigNumber }) => {
    if (rate.isNaN()) {
      return null;
    }

    return <OverviewBadge rate={rate} />;
  },
  (prevProps, nextProps) => prevProps.rate.isEqualTo(nextProps.rate),
);
RateBadgeMemo.displayName = 'RateBadgeMemo';

const ListHeader: FC<{
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
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isVerticalLayout = useIsVerticalLayout();
  const { account, network, networkId } = useActiveWalletAccount();
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  const iconBorderRadius = isVerticalLayout ? '12px' : '16px';

  const { data: accountTokens } = useAccountTokens({
    networkId,
    accountId: account?.id,
    useFilter: true,
  });

  const tokenCountOrAddToken = useMemo(
    () =>
      showTokenCount ? (
        <>
          <Text
            color="text-subdued"
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          >
            {accountTokens.length}
          </Text>
          <Icon name="ChevronRightMini" color="icon-subdued" />
        </>
      ) : (
        tokenEnabled &&
        !isAllNetworks(networkId) && (
          <IconButton
            size="sm"
            borderRadius={17}
            name="PlusMini"
            bg="action-secondary-default"
            onPress={() =>
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageToken,
                params: { screen: ManageTokenModalRoutes.Listing },
              })
            }
          />
        )
      ),
    [accountTokens.length, navigation, showTokenCount, tokenEnabled, networkId],
  );
  const Container = showTokenCount ? Pressable.Item : Box;

  const accountTokensValue = useAccountTokenValues(
    networkId,
    account?.id ?? '',
    true,
  ).value;

  const accountAllValue = useAccountValues({
    networkId,
    accountId: account?.id ?? '',
  }).value;

  const rate = useMemo(
    () => accountTokensValue.div(accountAllValue).multipliedBy(100),
    [accountAllValue, accountTokensValue],
  );

  return (
    <Container
      p={4}
      shadow={undefined}
      borderTopRadius={showRoundTop ? '12px' : 0}
      borderTopWidth={showRoundTop ? 1 : 0}
      borderWidth={1}
      borderBottomWidth={0}
      borderColor={borderColor}
      onPress={
        showTokenCount
          ? () => {
              navigation.navigate(HomeRoutes.FullTokenListScreen, {
                accountId: account?.id,
                networkId: network?.id,
              });
            }
          : undefined
      }
      flexDirection="column"
      bg="surface-subdued"
    >
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box
          w={iconOuterWidth}
          h={iconOuterWidth}
          borderRadius={iconBorderRadius}
          bg="decorative-icon-one"
          justifyContent="center"
          alignItems="center"
          mr={isVerticalLayout ? '8px' : '12px'}
        >
          <Icon
            size={iconInnerWidth}
            color="icon-on-primary"
            name="DatabaseOutline"
          />
        </Box>
        <Text typography={{ sm: 'Body1Strong', md: 'Heading' }}>
          {intl.formatMessage({
            id: 'asset__tokens',
          })}
        </Text>
        {!isVerticalLayout && (
          <Box flexDirection="row" alignItems="center">
            <Box
              mx="8px"
              my="auto"
              w="4px"
              h="4px"
              borderRadius="2px"
              bg="text-default"
            />
            <TokenBalancesMemo tokenAmount={accountTokensValue} />
          </Box>
        )}
        <RateBadgeMemo rate={rate} />
        <Box ml="auto" flexDirection="row" alignItems="center">
          {tokenCountOrAddToken}
        </Box>
      </Box>
      <Box mt={isVerticalLayout ? '8px' : '16px'}>
        {isVerticalLayout ? (
          <TokenBalancesMemo tokenAmount={accountTokensValue} />
        ) : (
          <Box flexDirection="row" w="full">
            <Typography.Subheading color="text-subdued" flex={1}>
              {intl.formatMessage({ id: 'title__assets' })}
            </Typography.Subheading>
            <Typography.Subheading
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'content__price_uppercase' })}
            </Typography.Subheading>
            <Typography.Subheading
              color="text-subdued"
              flex={1}
              textAlign="right"
            >
              {intl.formatMessage({ id: 'form__value' })}
            </Typography.Subheading>
          </Box>
        )}
      </Box>
    </Container>
  );
};

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
  const navigation = useNavigation<NavigationProps>();
  const { network, wallet, accountId } = useActiveWalletAccount();
  const { tokenEnabled: networkTokenEnabled, activateTokenRequired } =
    network?.settings ?? { tokenEnabled: false, activateTokenRequired: false };

  const tokenEnabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && activateTokenRequired) {
      return false;
    }
    return networkTokenEnabled;
  }, [activateTokenRequired, networkTokenEnabled, wallet?.type]);

  const navigationManageToken = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: { screen: ManageTokenModalRoutes.Listing },
    });
  }, [navigation]);

  const showHomeBalanceSettingsDialog = useCallback(() => {
    showHomeBalanceSettings({ networkId: network?.id });
  }, [network?.id]);

  return (
    <>
      {showOuterHeader && (
        <OuterHeader
          onNavigate={navigationManageToken}
          onShowHomeBalanceSettings={showHomeBalanceSettingsDialog}
          tokenEnabled={tokenEnabled}
          networkId={network?.id ?? ''}
          accountId={accountId ?? ''}
        />
      )}

      {showInnerHeader && (
        <>
          <ListHeader
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

export default AssetsListHeader;
