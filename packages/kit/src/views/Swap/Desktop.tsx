import { useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native-gesture-handler';

import {
  Box,
  Center,
  IconButton,
  Select,
  Token,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import SwapChart from '../PriceChart/SwapChart';

import SwapAlert from './SwapAlert';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import { SwapHeaderButtons } from './SwapHeader';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapTexts from './SwapTexts';
import SwapUpdater from './SwapUpdater';

const DesktopHeader = () => {
  const intl = useIntl();
  const swapChartMode = useAppSelector((s) => s.swapTransactions.swapChartMode);
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
          defaultValue={swapChartMode ?? 'chart'}
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
          renderTrigger={() => (
            <IconButton
              name="EllipsisVerticalOutline"
              type="plain"
              size="lg"
              pointerEvents="none"
              circle
              m={-2}
            />
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
          <Box />
          <SwapHeaderButtons />
        </Box>
        <Box px="4">
          <SwapContent />
        </Box>
        <Box px="4">
          <SwapAlert />
        </Box>
        <Box my="6" px="4">
          <SwapButton />
        </Box>
        <SwapQuote />
      </Box>
    </Center>
    <SwapUpdater />
    <SwapObserver />
    <SwapTexts />
  </Box>
);

const DesktopChart = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  if (!inputToken || !outputToken) {
    return null;
  }

  return (
    <Box w="550px">
      <SwapChart fromToken={inputToken} toToken={outputToken} />
    </Box>
  );
};

const DesktopChartLabel = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  return (
    <Box flexDirection="row">
      <Box flexDirection="row">
        <Center
          w="9"
          bg="background-default"
          borderRadius="full"
          overflow="hidden"
        >
          <Token token={inputToken} size={8} />
        </Center>
        <Center
          w="9"
          ml="-4"
          bg="background-default"
          borderRadius="full"
          overflow="hidden"
        >
          <Token token={outputToken} size={8} />
        </Center>
      </Box>
      <Typography.Heading ml="2" color="text-default" fontSize={18}>
        {inputToken?.symbol.toUpperCase()} / {outputToken?.symbol.toUpperCase()}
      </Typography.Heading>
    </Box>
  );
};

export const Desktop = () => {
  const navigation = useNavigation();
  const swapChartMode = useAppSelector((s) => s.swapTransactions.swapChartMode);
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const mode = swapChartMode || 'chart';

  return (
    <ScrollView>
      <DesktopHeader />
      <Box mt="12">
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="center"
        >
          {mode === 'chart' ? (
            <Box>
              <Box minH="52px">
                <DesktopChartLabel />
              </Box>
              <DesktopChart />
            </Box>
          ) : null}
          <Box w="480px">
            <DesktopMain />
          </Box>
        </Box>
      </Box>
    </ScrollView>
  );
};
