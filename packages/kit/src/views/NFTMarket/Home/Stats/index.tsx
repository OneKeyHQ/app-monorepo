import React, { FC, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  SegmentedControl,
  Text,
  ToggleButtonGroup,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import { HomeRoutes, HomeRoutesParams } from '../../../../routes/types';
import ChainSelector from '../../ChainSelector';
import DateSelector from '../../DateSelector';
import { useDefaultNetWork } from '../hook';

import {
  StatsListContext,
  StatsListContextValue,
  useStatsListContext,
} from './context';
import MarketCap from './MarketCap';
import Ranking from './Ranking';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.NFTMarketStatsList
>;

const ListHeader: FC = () => {
  const defaultNetwork = useDefaultNetWork();
  const [selectedNetwork, setSelectedNetwork] =
    useState<Network>(defaultNetwork);
  const isSmallScreen = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const setContext = useStatsListContext()?.setContext;
  const intl = useIntl();

  return (
    <Box
      paddingX={isSmallScreen ? '16px' : 0}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Text typography="Heading">
        {intl.formatMessage({
          id: 'content__stats',
        })}
      </Text>
      <Box flexDirection="row" alignItems="center">
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
        <Button
          onPress={() => {
            navigation.navigate(HomeRoutes.NFTMarketStatsList, {
              network: selectedNetwork,
            });
          }}
          height="32px"
          type="plain"
          size="sm"
          textProps={{ color: 'text-subdued' }}
        >
          {intl.formatMessage({
            id: 'action__view_all',
          })}
        </Button>
      </Box>
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
        paddingX={isSmallScreen ? '16px' : 0}
        flexDirection="row"
        justifyContent="space-between"
        height="36px"
        mt="12px"
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
          selectedIndex={selectedIndex}
          bg="background-default"
          onButtonPress={(index) => {
            setSelectedIndex(index);
            if (setContext) {
              setContext((ctx) => ({
                ...ctx,
                selectedIndex: index,
              }));
            }
          }}
        />
        {context?.isTab && isSmallScreen && (
          <Text
            position="absolute"
            right="16px"
            top="8px"
            typography="Body2"
            color="text-subdued"
          >
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
          <Box width="160px" height="36px" position="absolute" right="16px">
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

  return (
    <StatsListContext.Provider value={{ context, setContext }}>
      <ListHeader />
      <StatsList />
    </StatsListContext.Provider>
  );
};

export default StatsModule;
