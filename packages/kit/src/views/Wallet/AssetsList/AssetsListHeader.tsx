import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Divider,
  Icon,
  IconButton,
  Pressable,
  Text,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/engine/src/types/wallet';
import type {
  HomeRoutesParams,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

import { FormatCurrencyNumber } from '../../../components/Format';
import {
  useAccountTokens,
  useAccountUsdValues,
  useNavigation,
} from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { useAccountTokenValues } from '../../../hooks/useTokens';
import { showHomeBalanceSettings } from '../../Overlay/HomeBalanceSettings';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
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

  const accountTokens = useAccountTokens(networkId, account?.id, true);

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
        tokenEnabled && (
          <IconButton
            size="sm"
            borderRadius={17}
            name="PlusMini"
            bg="action-secondary-default"
            onPress={() =>
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageToken,
                params: { screen: ManageTokenRoutes.Listing },
              })
            }
          />
        )
      ),
    [accountTokens.length, navigation, showTokenCount, tokenEnabled],
  );
  const Container = showTokenCount ? Pressable.Item : Box;

  const accountTokensValue = useAccountTokenValues(
    networkId,
    account?.id ?? '',
    true,
    'usd',
  ).value;

  const accountAllValue = useAccountUsdValues({
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
                  decimals={2}
                  value={0}
                  convertValue={accountTokensValue}
                />
              )}
            </Text>
          </Box>
        )}
        {rate.isNaN() ? null : (
          <Badge title={`${rate.toFixed(2)}%`} size="lg" ml="2" />
        )}
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
                decimals={2}
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
              ml="44px"
              color="text-subdued"
              flex={1}
              textAlign="right"
              pr="6"
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
  const { network, wallet } = useActiveWalletAccount();
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
            <>
              <IconButton
                onPress={() =>
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.ManageToken,
                    params: { screen: ManageTokenRoutes.Listing },
                  })
                }
                size="sm"
                name="PlusMini"
                type="plain"
                ml="auto"
                mr={3}
              />
              <IconButton
                onPress={showHomeBalanceSettings}
                size="sm"
                name="Cog8ToothMini"
                type="plain"
                mr={-2}
              />
            </>
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
