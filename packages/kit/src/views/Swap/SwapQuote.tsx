import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography, utils } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setReceiving } from '../../store/reducers/swap';
import { AddressBookRoutes } from '../AddressBook/routes';

import SwappingVia from './components/SwappingVia';
import TransactionRate from './components/TransactionRate';
import { useReceivingAddress, useSwapState } from './hooks/useSwap';
import { SwapRoutes } from './typings';
import { isNoCharge } from './utils';

const SwapArrivalTime = () => {
  const intl = useIntl();
  const arrivalTime = useAppSelector((s) => s.swap.quote?.arrivalTime);
  const text = useMemo(() => {
    if (!arrivalTime) {
      return intl.formatMessage(
        { id: 'content__str_mins' },
        { 'content__str_mins': 1 },
      );
    }
    if (arrivalTime < 60) {
      return intl.formatMessage(
        { id: 'content__str_seconds' },
        { 'content__str_seconds': arrivalTime },
      );
    }
    const minutes = Math.ceil(arrivalTime / 60);
    return intl.formatMessage(
      { id: 'content__str_mins' },
      { 'content__str_mins': minutes },
    );
  }, [arrivalTime, intl]);
  return (
    <Typography.Caption color="text-subdued">&lt;{text}</Typography.Caption>
  );
};

const SwapReceiving = () => {
  const navigation = useNavigation();
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const { address, name } = useReceivingAddress();
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.AddressBook,
      params: {
        screen: AddressBookRoutes.EnterAddressRoute,
        params: {
          defaultAddress: address,
          networkId: outputTokenNetwork?.id,
          onSelected: ({ address: selectedAddress, name: selectedName }) => {
            backgroundApiProxy.dispatch(
              setReceiving({ address: selectedAddress, name: selectedName }),
            );
          },
        },
      },
    });
  }, [navigation, outputTokenNetwork?.id, address]);

  let text = '';
  if (address && name) {
    text = `${name}(${address.slice(-4)})`;
  } else if (address) {
    text = `${utils.shortenAddress(address)}`;
  }

  if (address) {
    return (
      <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
        <Typography.Caption color="text-subdued" mr="1" numberOfLines={1}>
          {text}
        </Typography.Caption>
        <Icon size={16} name="PencilAltOutline" />
      </Pressable>
    );
  }

  return null;
};

const SwapQuote = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { inputToken, outputToken, quote } = useSwapState();
  const { address } = useReceivingAddress();
  const swapSlippagePercent = useAppSelector(
    (s) => s.settings.swapSlippagePercent,
  );

  const onSettting = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Settings,
      },
    });
  }, [navigation]);

  if (!quote) {
    return null;
  }

  return (
    <Box>
      {address ? (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mb="4"
        >
          <Typography.Caption color="text-disabled" mr="2">
            {intl.formatMessage({ id: 'form__receiving_address' })}
          </Typography.Caption>
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
            <Box maxW="full">
              <SwapReceiving />
            </Box>
          </Box>
        </Box>
      ) : null}
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'title__slippage' })}
        </Typography.Caption>

        <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
          <Pressable flexDirection="row" onPress={onSettting}>
            <Typography.Caption mr="1" color="text-subdued">
              Auto({swapSlippagePercent}%)
            </Typography.Caption>
            <Icon size={16} name="PencilAltOutline" />
          </Pressable>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'Rate' })}
        </Typography.Caption>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <Box maxW="full">
            <TransactionRate
              tokenA={inputToken}
              tokenB={outputToken}
              rate={quote?.instantRate}
              typography="Caption"
              color="text-subdued"
            />
          </Box>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'form__swapping_via' })}
        </Typography.Caption>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <SwappingVia providers={quote.providers} />
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'title__price_impact' })}
        </Typography.Caption>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <Typography.Caption color="text-subdued">
            &lt;0.01%
          </Typography.Caption>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'form__included_onekey_fee' })}
        </Typography.Caption>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          {isNoCharge(quote.type) ? (
            <Box flexDirection="column" alignItems="flex-end">
              <Typography.Caption color="text-subdued" strikeThrough>
                0.2 - 0.875%
              </Typography.Caption>
              <Typography.Caption color="text-success">
                {intl.formatMessage({ id: 'form__free_limited_time' })}
              </Typography.Caption>
            </Box>
          ) : (
            <Typography.Caption color="text-subdued">
              0.2 - 0.875%
            </Typography.Caption>
          )}
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        mb="4"
      >
        <Typography.Caption color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'title__arrival_time' })}
        </Typography.Caption>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <SwapArrivalTime />
        </Box>
      </Box>
    </Box>
  );
};

export default SwapQuote;
