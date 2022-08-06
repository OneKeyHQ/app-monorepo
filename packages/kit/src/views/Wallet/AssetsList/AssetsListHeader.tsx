import { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Icon,
  IconButton,
  Pressable,
  Text,
  Typography,
  useIsVerticalLayout,
  useTheme,
} from '@onekeyhq/components';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  RootRoutes,
  RootRoutesParams,
} from '@onekeyhq/kit/src/routes/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';

import { FormatCurrencyNumber } from '../../../components/Format';
import { useManageTokens, useNavigation } from '../../../hooks';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks/redux';
import { getSummedValues } from '../../../utils/priceUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.FullTokenListScreen>;

const ListHeader: FC<{ showTokenCount?: boolean; showRoundTop?: boolean }> = ({
  showTokenCount,
  showRoundTop,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const isVerticalLayout = useIsVerticalLayout();
  const { account, network } = useActiveWalletAccount();
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  const iconBorderRadius = isVerticalLayout ? '12px' : '16px';

  const { accountTokens, balances, prices } = useManageTokens();

  const summedValue = useMemo(() => {
    const displayValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices,
      hideSmallBalance,
    }).toNumber();

    return (
      <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
        {Number.isNaN(displayValue) ? (
          ' '
        ) : (
          <FormatCurrencyNumber decimals={2} value={displayValue} />
        )}
      </Text>
    );
  }, [accountTokens, balances, hideSmallBalance, prices]);

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
          <Icon name="ChevronRightSolid" />
        </>
      ) : (
        <IconButton
          size="sm"
          borderRadius={17}
          name="PlusSolid"
          bg="action-secondary-default"
          onPress={() =>
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageToken,
              params: { screen: ManageTokenRoutes.Listing },
            })
          }
        />
      ),
    [accountTokens.length, navigation, showTokenCount],
  );
  const Container = showTokenCount ? Pressable.Item : Box;

  return (
    <Container
      p={4}
      shadow={undefined}
      borderTopRadius={showRoundTop ? '12px' : 0}
      borderTopWidth={showRoundTop ? 1 : 0}
      borderWidth={1}
      borderBottomWidth={0}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
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
            {summedValue}
          </Box>
        )}
        <Box ml="auto" flexDirection="row" alignItems="center">
          {tokenCountOrAddToken}
        </Box>
      </Box>
      <Box mt={isVerticalLayout ? '8px' : '16px'}>
        {isVerticalLayout ? (
          summedValue
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
}> = ({
  showInnerHeader,
  showTokenCount,
  showOuterHeader,
  showInnerHeaderRoundTop,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { network } = useActiveWalletAccount();
  const { tokenEnabled } = network?.settings ?? { tokenEnabled: false };
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
            <Button
              onPress={() =>
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.ManageToken,
                  params: { screen: ManageTokenRoutes.Listing },
                })
              }
              size="sm"
              leftIconName="CogSolid"
              type="plain"
              mr={-3}
            >
              <Typography.Button2>
                {intl.formatMessage({ id: 'title__settings' })}
              </Typography.Button2>
            </Button>
          )}
        </Box>
      )}

      {showInnerHeader && (
        <>
          <ListHeader
            showRoundTop={showInnerHeaderRoundTop}
            showTokenCount={showTokenCount}
          />
          <Divider />
        </>
      )}
    </>
  );
};
AssetsListHeader.displayName = 'AssetsListHeader';

export default AssetsListHeader;
