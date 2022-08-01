import { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Icon,
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
import { useActiveWalletAccount } from '../../../hooks/redux';
import { getSummedValues } from '../../../utils/priceUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ListHeader: FC = () => {
  const intl = useIntl();
  // const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const isVerticalLayout = useIsVerticalLayout();
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  const iconBorderRadius = isVerticalLayout ? '12px' : '16px';

  const { accountTokens, balances, prices } = useManageTokens();

  const summedValue = useMemo(() => {
    const displayValue = getSummedValues({
      tokens: accountTokens,
      balances,
      prices,
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
  }, [accountTokens, balances, prices]);

  return (
    <Pressable.Item
      p={4}
      shadow={undefined}
      borderTopRadius="12px"
      borderWidth={1}
      borderBottomWidth={0}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
      disabled
      // onPress={onPress}
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
        <Box ml="auto">{/* TODO token count */}</Box>
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
    </Pressable.Item>
  );
};

const AssetsListHeader: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { network } = useActiveWalletAccount();
  const { tokenEnabled } = network?.settings ?? { tokenEnabled: false };
  return (
    <>
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
      <ListHeader />
      <Divider />
    </>
  );
};
AssetsListHeader.displayName = 'AssetsListHeader';

export default AssetsListHeader;
