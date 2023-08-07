import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

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
  useNavigation,
} from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { ManageTokenModalRoutes } from '../../../routes/routesEnum';
import { showHomeBalanceSettings } from '../../Overlay/HomeBalanceSettings';
import { OverviewBadge } from '../../Overview/components/OverviewBadge';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

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
            <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
              {accountTokensValue.isNaN() ? (
                ' '
              ) : (
                <FormatCurrencyNumber
                  value={0}
                  convertValue={accountTokensValue}
                />
              )}
            </Text>
          </Box>
        )}
        {rate.isNaN() ? null : <OverviewBadge rate={rate} />}
        <Box ml="auto" flexDirection="row" alignItems="center">
          {tokenCountOrAddToken}
        </Box>
      </Box>
      <Box mt={isVerticalLayout ? '8px' : '16px'}>
        {isVerticalLayout ? (
          <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
            {Number.isNaN(accountTokensValue) ? (
              ' '
            ) : (
              <FormatCurrencyNumber
                value={0}
                convertValue={accountTokensValue}
              />
            )}
          </Text>
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
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { network, wallet, networkId, accountId } = useActiveWalletAccount();
  const { tokenEnabled: networkTokenEnabled, activateTokenRequired } =
    network?.settings ?? { tokenEnabled: false, activateTokenRequired: false };

  const loading = useAccountIsUpdating({
    networkId,
    accountId,
  });

  const tokenEnabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && activateTokenRequired) {
      return false;
    }
    return networkTokenEnabled;
  }, [activateTokenRequired, networkTokenEnabled, wallet?.type]);

  const refresh = useCallback(() => {
    backgroundApiProxy.serviceOverview.refreshCurrentAccount();
  }, []);

  const homeTabName = useAppSelector((s) => s.status.homeTabName);

  const refreshButton = useMemo(
    () => (
      <Box alignItems="center" justifyContent="center" w="8" h="8" mr="3">
        {loading ? (
          <Spinner size="sm" key={homeTabName} />
        ) : (
          <IconButton
            onPress={refresh}
            size="sm"
            name="ArrowPathMini"
            type="plain"
            ml="auto"
          />
        )}
      </Box>
    ),
    [loading, refresh, homeTabName],
  );

  return (
    <>
      {showOuterHeader && (
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
              {refreshButton}
              {isAllNetworks(network?.id) ? null : (
                <IconButton
                  onPress={() =>
                    navigation.navigate(RootRoutes.Modal, {
                      screen: ModalRoutes.ManageToken,
                      params: { screen: ManageTokenModalRoutes.Listing },
                    })
                  }
                  size="sm"
                  name="PlusMini"
                  type="plain"
                  ml="auto"
                  mr={3}
                />
              )}
              <IconButton
                onPress={() => {
                  showHomeBalanceSettings({ networkId: network?.id });
                }}
                size="sm"
                name="Cog8ToothMini"
                type="plain"
                mr={-2}
              />
            </HStack>
          )}
        </Box>
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
