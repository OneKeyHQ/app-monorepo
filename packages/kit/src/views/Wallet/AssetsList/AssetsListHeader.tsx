import { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
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

import { useNavigation } from '../../../hooks';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
> &
  NativeStackNavigationProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

const ListHeader: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { themeVariant } = useTheme();
  const isVerticalLayout = useIsVerticalLayout();
  const iconOuterWidth = isVerticalLayout ? '24px' : '32px';
  const iconInnerWidth = isVerticalLayout ? 12 : 16;
  return (
    <Pressable.Item
      p={4}
      shadow={undefined}
      borderTopRadius="12px"
      borderWidth={1}
      borderColor={themeVariant === 'light' ? 'border-subdued' : 'transparent'}
      disabled
      // onPress={onPress}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <Box flexDirection="row" alignItems="center">
          <Box
            w={iconOuterWidth}
            h={iconOuterWidth}
            borderRadius="50%"
            bg="decorative-icon-one"
            justifyContent="center"
            alignItems="center"
            mr={isVerticalLayout ? '8px' : '12px'}
          >
            {/* <Box w="12px" h="12px"> */}
            <Icon
              size={iconInnerWidth}
              color="icon-on-primary"
              name="DatabaseOutline"
            />
            {/* </Box> */}
          </Box>
          <Text typography={{ sm: 'Body1Strong', md: 'Heading' }}>
            {intl.formatMessage({
              id: 'asset__tokens',
            })}
          </Text>
        </Box>

        {/* <Token size={8} src={token.logoURI} />
        <Box mx={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {token.name}
          </Text>
          {balance ? (
            <FormatBalance
              balance={balance}
              suffix={token.symbol}
              formatOptions={{
                fixed: decimal ?? 4,
              }}
              render={(ele) => (
                <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
              )}
            />
          ) : (
            <Skeleton shape={isVerticalLayout ? 'Body1' : 'Body2'} />
          )}
        </Box>
        {!isVerticalLayout && !hidePriceInfo && (
          <Box mx={3} flexDirection="column" flex={1}>
            {price !== undefined ? (
              <Typography.Body2Strong textAlign="right">
                <FormattedNumber
                  value={price}
                  currencyDisplay="narrowSymbol"
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency={selectedFiatMoneySymbol}
                />
              </Typography.Body2Strong>
            ) : (
              <Skeleton shape="Body2" />
            )}
          </Box>
        )}
        <Box mx={3} flexDirection="column" flex={1}>
          {tokenValue !== undefined ? (
            <Box alignSelf="flex-end">
              <Typography.Body2Strong textAlign="right">
                <FormattedNumber
                  value={tokenValue}
                  currencyDisplay="narrowSymbol"
                  // eslint-disable-next-line react/style-prop-object
                  style="currency"
                  currency={selectedFiatMoneySymbol}
                />
              </Typography.Body2Strong>
              <Box
                mt="4px"
                bg={gainTextBg}
                px="6px"
                py="2px"
                borderRadius="6px"
                justifyContent="center"
                alignItems="center"
              >
                <Typography.CaptionStrong color={gainTextColor}>
                  {percentageGain}
                </Typography.CaptionStrong>
              </Box>
            </Box>
          ) : (
            <Skeleton shape="Body2" />
          )}
        </Box> */}
      </Box>
    </Pressable.Item>
  );
};

const AssetsListHeader: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
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
        <Box flexDirection="row">
          <IconButton
            onPress={() =>
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageToken,
                params: { screen: ManageTokenRoutes.Listing },
              })
            }
            size="sm"
            name="CogSolid"
            type="plain"
            circle
          >
            <Typography.Button2>
              {intl.formatMessage({ id: 'title__settings' })}
            </Typography.Button2>
          </IconButton>
        </Box>
      </Box>
      <ListHeader />
      <Divider />
    </>
  );
};
AssetsListHeader.displayName = 'AssetsListHeader';

export default AssetsListHeader;
