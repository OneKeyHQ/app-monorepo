import { useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native-gesture-handler';

import {
  Box,
  Center,
  Icon,
  Pressable,
  Select,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import ChartLabel from '../PriceChart/swap-chart/ChartLabel';
import SwapChart from '../PriceChart/swap-chart/desktop';

import { useSwapChartMode } from './hooks/useSwapUtils';
import { Main } from './Main';
import { PendingLimitOrdersProfessionalContent } from './Main/LimitOrder/PendingContent';
import { SwapHeader } from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapUpdater from './SwapUpdater';

const DesktopHeader = () => {
  const intl = useIntl();
  const swapChartMode = useSwapChartMode();
  return (
    <Box
      h="16"
      px="8"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Typography.Heading>
        {intl.formatMessage({ id: 'title__Swap_Bridge' })}
      </Typography.Heading>
      <Box>
        <Select<string>
          isTriggerPlain
          footer={null}
          headerShown={false}
          defaultValue={swapChartMode}
          onChange={(value) => {
            backgroundApiProxy.serviceSwap.setSwapChartMode(value);
          }}
          options={[
            {
              label: intl.formatMessage({
                id: 'title__simple_mode',
              }),
              value: 'simple',
            },
            {
              label: intl.formatMessage({
                id: 'title__chart_mode',
              }),
              value: 'chart',
            },
          ]}
          dropdownProps={{ width: '40' }}
          dropdownPosition="right"
          renderTrigger={({ onPress }) => (
            <Pressable onPress={onPress}>
              {({ isHovered }) => {
                const toggleButtonBg = () => {
                  if (isHovered) return 'surface-hovered';
                  return 'transparent';
                };
                return (
                  <Box
                    bg={toggleButtonBg()}
                    w="10"
                    h="10"
                    justifyContent="center"
                    alignItems="center"
                    borderRadius="full"
                  >
                    <Icon name="EllipsisVerticalOutline" size={24} />
                  </Box>
                );
              }}
            </Pressable>
          )}
        />
      </Box>
    </Box>
  );
};

const DesktopMain = () => (
  <Box>
    <Center>
      <Box maxW={{ md: '480px' }} width="full">
        <Box
          flexDirection="row"
          justifyContent="space-between"
          px="4"
          mb="4"
          zIndex={1}
        >
          <SwapHeader />
        </Box>
        <Box px="4">
          <Main />
        </Box>
      </Box>
    </Center>
    <SwapUpdater />
    <SwapObserver />
  </Box>
);

const DesktopChart = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  if (!inputToken || !outputToken) {
    return null;
  }

  return (
    <Box>
      <Box minH="52px">
        <ChartLabel inputToken={inputToken} outputToken={outputToken} />
      </Box>
      <SwapChart fromToken={inputToken} toToken={outputToken} />
    </Box>
  );
};

export const Desktop = () => {
  const navigation = useNavigation();
  const mode = useSwapChartMode();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <ScrollView>
      <DesktopHeader />
      <Box mt="12">
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="center"
          px={mode === 'chart' ? '8' : undefined}
          overflow="hidden"
        >
          {mode === 'chart' ? (
            <Box flex="1">
              <DesktopChart />
              <PendingLimitOrdersProfessionalContent />
            </Box>
          ) : null}
          <Box w="480px" bg="background-default">
            <DesktopMain />
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
};
