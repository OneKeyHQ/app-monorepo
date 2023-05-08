import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  SegmentedControl,
  Text,
  ToggleButtonGroup,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { HomeRoutes } from '../../../../routes/routesEnum';
import ChainSelector from '../../ChainSelector';
import DateSelector from '../../DateSelector';
import { useDefaultNetWork } from '../hook';

import { StatsListContext, useStatsListContext } from './context';
import MarketCap from './MarketCap';
import Ranking from './Ranking';

import type { HomeRoutesParams } from '../../../../routes/types';
import type { StatsListContextValue } from './context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTMarketStatsList
>;

const ListHeader: FC = () => {
  const defaultNetwork = useDefaultNetWork();
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(defaultNetwork);
  const navigation = useNavigation<NavigationProps>();
  const setContext = useStatsListContext()?.setContext;
  const context = useStatsListContext()?.context;
  const intl = useIntl();

  return (
    <Box flexDirection="row" justifyContent="space-between" mb="12px">
      <Text typography="Heading">
        {intl.formatMessage({
          id: 'content__stats',
        })}
      </Text>
      <HStack alignItems="center" space="20px">
        <ChainSelector
          selectedNetwork={selectedNetwork}
          onChange={(n) => {
            setSelectedNetwork(n);
            if (setContext) {
              setContext((ctx) => ({
                ...ctx,
                selectedNetwork: n,
              }));
            }
          }}
        />
        <Box m="-8px" mr="-12px">
          <Pressable
            onPress={() => {
              navigation.navigate(HomeRoutes.NFTMarketStatsList, {
                network: selectedNetwork,
                selectedIndex: context?.selectedIndex,
              });
            }}
            p="8px"
            rounded="xl"
            flexDirection="row"
            alignItems="center"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
          >
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              color="text-subdued"
              mr="4px"
            >
              {intl.formatMessage({
                id: 'action__see_all',
              })}
            </Text>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Pressable>
        </Box>
      </HStack>
    </Box>
  );
};

export const StatsList = () => {
  const context = useStatsListContext()?.context;
  const setContext = useStatsListContext()?.setContext;
  const [selectedTime, setSelectedTime] = useState(context?.selectedTime ?? 0);
  const [selectedIndex, setSelectedIndex] = useState(
    context?.selectedIndex ?? 0,
  );
  const isSmallScreen = useIsVerticalLayout();
  const intl = useIntl();

  const volumeTitle = useMemo(() => {
    switch (context?.selectedTime) {
      case 0:
        return intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 6 },
        );
      case 1:
        return intl.formatMessage(
          {
            id: 'content__int_hours_volume',
          },
          { 0: 12 },
        );
      case 2:
        return intl.formatMessage(
          {
            id: 'content__int_day_volume',
          },
          { 0: 1 },
        );
      default:
        break;
    }
  }, [context?.selectedTime, intl]);

  return (
    <>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="16px"
      >
        <ToggleButtonGroup
          buttons={[
            {
              text: intl.formatMessage({
                id: 'content__ranking',
              }),
            },
            {
              text: intl.formatMessage({
                id: 'content__market_cap',
              }),
            },
          ]}
          size="lg"
          selectedIndex={selectedIndex}
          bg="transparent"
          onButtonPress={(index) => {
            setSelectedIndex(index);
            if (setContext) {
              setContext((ctx) => ({
                ...ctx,
                selectedIndex: index,
              }));
            }
          }}
          flex={1}
        />
        {context?.isTab && isSmallScreen && (
          <Text typography="Body2" color="text-subdued" textAlign="right">
            {selectedIndex === 0
              ? intl.formatMessage(
                  {
                    id: 'content__int_day_volume',
                  },
                  { 0: 1 },
                )
              : ''}
          </Text>
        )}
        {!context?.isTab && context?.selectedIndex === 0 && isSmallScreen && (
          <DateSelector
            title={volumeTitle}
            onChange={(time) => {
              setSelectedTime(time);
              if (setContext) {
                setContext((ctx) => ({
                  ...ctx,
                  selectedTime: time,
                }));
              }
            }}
          />
        )}
        {!context?.isTab && context?.selectedIndex === 0 && !isSmallScreen && (
          <Box width="160px">
            <SegmentedControl
              values={['6H', '12H', '1D']}
              selectedIndex={selectedTime}
              onChange={(index) => {
                setSelectedTime(index);
                if (setContext) {
                  setContext((ctx) => ({
                    ...ctx,
                    selectedTime: index,
                  }));
                }
              }}
            />
          </Box>
        )}
      </Box>
      {selectedIndex === 0 ? <Ranking /> : <MarketCap />}
    </>
  );
};
const StatsModule = () => {
  const defaultNetwork = useDefaultNetWork();
  const [context, setContext] = useState<StatsListContextValue>({
    isTab: true,
    selectedNetwork: defaultNetwork,
    selectedIndex: 0,
    selectedTime: 2,
  });

  const contextValue = useMemo(() => ({ context, setContext }), [context]);

  return (
    <StatsListContext.Provider value={contextValue}>
      <ListHeader />
      <StatsList />
    </StatsListContext.Provider>
  );
};

export default StatsModule;
