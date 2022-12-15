import React, { useLayoutEffect, FC, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Center,
  Typography,
  Select,
  IconButton,
} from '@onekeyhq/components';
import { useIntl } from 'react-intl'

import SwapAlert from './SwapAlert';
import SwapButton from './SwapButton';
import SwapContent from './SwapContent';
import SwapObserver from './SwapObserver';
import SwapQuote from './SwapQuote';
import SwapUpdater from './SwapUpdater';
import PriceChart from '../PriceChart/PriceChart'
import { SwapHeaderButtons } from './SwapHeader'
import { useAppSelector, useNavigation } from '../../hooks/'

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import network from '../../store/reducers/network';


const DesktopHeader = () => {
  const intl = useIntl()
  const swapChartMode = useAppSelector(s => s.swapTransactions.swapChartMode)
  return (
    <Box h='16' px='8' flexDirection='row' alignItems='center' justifyContent='space-between'>
      <Typography.Heading>{intl.formatMessage({ id: 'title__Swap_Bridge' })}</Typography.Heading>
      <Box>
        <Select<string>
          isTriggerPlain
          footer={null}
          headerShown={false}
          defaultValue={swapChartMode ?? 'chart'}
          onChange={(value) => {
            backgroundApiProxy.serviceSwap.setSwapChartMode(value)
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
              pointerEvents='none'
              circle
              m={-2}
            />
          )}
        />
      </Box>
    </Box>
  )
}

const DesktopMain = () => {
  return <Box>
    <Center>
      <Box maxW={{ md: '480px' }} width="full">
        <Box flexDirection='row' justifyContent='space-between' px='4' mb='4'>
          <Box></Box>
          <SwapHeaderButtons />
        </Box>
        <Box px={'4'}>
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
  </Box>
}

type TokenChartProps = { networkId: string, tokenIdOnNetwork?: string  }
const Chart: FC<TokenChartProps> = ({ networkId, tokenIdOnNetwork }) => {
  return <PriceChart networkId={networkId} contract={tokenIdOnNetwork}></PriceChart>
}

const DesktopChart = () => {
  const inputToken = useAppSelector(s => s.swap.inputToken);
  if (!inputToken) {
    return null
  }
  const key =`${inputToken.networkId}${inputToken.tokenIdOnNetwork}`
  return <Box w='550px'><PriceChart key={key} networkId={inputToken.networkId} contract={inputToken.tokenIdOnNetwork}></PriceChart></Box>
}

export const Desktop = () => {
  const navigation = useNavigation();
  const swapChartMode = useAppSelector(s => s.swapTransactions.swapChartMode)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <Box>
      <DesktopHeader />
      <Box mt='12'>
        <Box flexDirection='row' alignItems='flex-start' justifyContent='center'> {swapChartMode === 'chart' ?  <Box><Box h='52px'></Box><DesktopChart /></Box> : null} <Box w='480px'><DesktopMain /></Box></Box>
      </Box>
    </Box>
  )
};
