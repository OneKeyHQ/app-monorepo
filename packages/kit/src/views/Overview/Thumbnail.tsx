import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Text,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../components/Format';
import { useAccountValues, useAppSelector, useNavigation } from '../../hooks';
import { useCurrentFiatValue } from '../../hooks/useTokens';
import { HomeRoutes, ModalRoutes, RootRoutes } from '../../routes/routesEnum';

import { OverviewBadge } from './components/OverviewBadge';
import { OverviewModalRoutes } from './types';

import type { HomeRoutesParams, RootRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Main
> &
  NativeStackNavigationProp<
    HomeRoutesParams,
    HomeRoutes.OverviewDefiListScreen
  >;

export type OverviewDefiListProps = {
  networkId: string;
  accountId: string;
  address: string;
  limitSize?: number;
};

export type IAssetHeaderProps = {
  name: string;
  value: B;
  itemLength: number;
  accountAllValue: B;
  onPress: () => void;
};

const AssetHeader: FC<IAssetHeaderProps> = ({
  name,
  value,
  itemLength,
  accountAllValue,
  onPress,
}) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const rate = useMemo(
    () => value.div(accountAllValue).multipliedBy(100),
    [value, accountAllValue],
  );

  const protocolValueComp = useMemo(
    () => (
      <>
        {isVertical ? null : (
          <Box
            mx="2"
            my="auto"
            w="1"
            h="1"
            borderRadius="2px"
            bg="text-default"
          />
        )}
        <Text typography={{ sm: 'DisplayLarge', md: 'Heading' }}>
          <FormatCurrencyNumber value={value} />
        </Text>
      </>
    ),
    [value, isVertical],
  );

  return (
    <VStack bg="surface-default">
      <Pressable.Item px="6" py="4" bg="surface-subdued" onPress={onPress}>
        <VStack flex="1">
          <HStack flex="1">
            <HStack flex="1" alignItems="center">
              <Box
                size={isVertical ? 6 : 8}
                borderRadius="full"
                bg="decorative-icon-one"
                justifyContent="center"
                alignItems="center"
                mr={isVertical ? '8px' : '12px'}
              >
                <Icon
                  size={isVertical ? 12 : 16}
                  color="icon-on-primary"
                  name="DatabaseOutline"
                />
              </Box>
              <Typography.Heading>{name}</Typography.Heading>
              {isVertical ? null : protocolValueComp}
              {rate.isGreaterThan(0) ? <OverviewBadge rate={rate} /> : null}
            </HStack>
            <HStack alignItems="center">
              <Typography.Body2Strong color="text-subdued">
                {itemLength}
              </Typography.Body2Strong>
              <Icon size={24} name="ChevronRightMini" />
            </HStack>
          </HStack>
          {isVertical ? protocolValueComp : null}
        </VStack>
      </Pressable.Item>
      {isVertical ? null : (
        <HStack mt="4" px="6" bg="surface-default">
          <Typography.Subheading flex="1" color="text-subdued">
            {intl.formatMessage({ id: 'form__protocols_uppercase' })}
          </Typography.Subheading>
          <Typography.Subheading flex="1" color="text-subdued">
            {intl.formatMessage({ id: 'form__claimable_uppercase' })}
          </Typography.Subheading>
          <Typography.Subheading
            flex="1"
            color="text-subdued"
            textAlign="right"
          >
            {intl.formatMessage({ id: 'form__value_uppercase' })}
          </Typography.Subheading>
        </HStack>
      )}
    </VStack>
  );
};

const OverviewDefiThumbnalWithoutMemo: FC<OverviewDefiListProps> = (props) => {
  const { networkId, address, limitSize, accountId } = props;
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();

  const fiat = useCurrentFiatValue();

  const defis = useAppSelector(
    (s) => s.overview.defi?.[`${networkId}--${address}`] ?? [],
  );

  const allDefiValues = useMemo(
    () =>
      defis
        .reduce((sum, next) => sum.plus(next.protocolValue), new B(0))
        .multipliedBy(fiat),
    [defis, fiat],
  );

  const accountAllValue = useAccountValues({
    networkId,
    accountId,
  }).value;

  const handlePressHeader = useCallback(() => {
    navigation.navigate(HomeRoutes.OverviewDefiListScreen, {
      networkId,
      address,
    });
  }, [navigation, networkId, address]);

  if (!defis.length) {
    return null;
  }

  return (
    <VStack
      overflow="hidden"
      borderColor="border-subdued"
      borderWidth="1px"
      borderRadius={12}
      mb="24"
    >
      <AssetHeader
        name="DeFi"
        value={allDefiValues}
        accountAllValue={accountAllValue}
        itemLength={defis.length}
        onPress={handlePressHeader}
      />
      {defis.slice(0, limitSize).map((item, idx) => (
        <Pressable.Item
          key={item._id.protocolId}
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Overview,
              params: {
                screen: OverviewModalRoutes.OverviewProtocolDetail,
                params: {
                  protocolId: item._id.protocolId,
                  networkId,
                  address,
                  accountId,
                },
              },
            });
          }}
          flex={1}
          px="6"
          py="4"
          flexDirection="row"
          alignItems="center"
          borderTopWidth={idx === 0 ? 0 : '1px'}
          borderTopColor="divider"
        >
          <Token
            flex="1"
            size={8}
            showInfo
            infoBoxProps={{ flex: 1 }}
            token={{
              logoURI: item.protocolIcon,
              name: item.protocolName,
            }}
          />
          {isVertical ? null : (
            <Typography.Body2Strong flex="1" numberOfLines={2} isTruncated>
              <FormatCurrencyNumber
                value={0}
                convertValue={+item.claimableValue}
              />
            </Typography.Body2Strong>
          )}
          <Typography.Body2Strong
            flex="1"
            textAlign="right"
            numberOfLines={2}
            isTruncated
          >
            <FormatCurrencyNumber
              value={0}
              convertValue={+item.protocolValue}
            />
          </Typography.Body2Strong>
        </Pressable.Item>
      ))}
    </VStack>
  );
};

export const OverviewDefiThumbnal = memo(OverviewDefiThumbnalWithoutMemo);
