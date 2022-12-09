import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Pressable,
  Switch,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setDisableSwapExactApproveAmount } from '../../store/reducers/settings';

import { ArrivalTime } from './components/ArrivalTime';
import SwappingVia from './components/SwappingVia';
import TransactionFee from './components/TransactionFee';
import TransactionRate from './components/TransactionRate';
import { SwapRoutes } from './typings';

const SwapArrivalTime = () => {
  const arrivalTime = useAppSelector((s) => s.swap.quote?.arrivalTime);
  return <ArrivalTime value={arrivalTime} />;
};

const SwapExactAmoutAllowance = () => {
  const intl = useIntl();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );
  const onToggle = useCallback(() => {
    backgroundApiProxy.dispatch(
      setDisableSwapExactApproveAmount(!disableSwapExactApproveAmount),
    );
  }, [disableSwapExactApproveAmount]);
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      mb="4"
    >
      <Typography.Caption color="text-disabled" mr="2">
        {intl.formatMessage({ id: 'form__exact_amount_allowance' })}
      </Typography.Caption>
      <Box flex="1" flexDirection="row" justifyContent="flex-end">
        <Box maxW="full">
          <Switch
            size="mini"
            labelType="false"
            isChecked={!disableSwapExactApproveAmount}
            onToggle={onToggle}
          />
        </Box>
      </Box>
    </Box>
  );
};

const SwapQuote = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const quote = useAppSelector((s) => s.swap.quote);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const showMoreQuoteDetail = useAppSelector((s) => s.swap.showMoreQuoteDetail);
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

  const onSelectRoute = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.SelectRoutes,
      },
    });
  }, [navigation]);

  if (!quote) {
    return null;
  }

  return (
    <Box px="4">
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
      {!showMoreQuoteDetail ? (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mb="4"
        >
          <Typography.Caption color="text-disabled" mr="2">
            {intl.formatMessage({ id: 'form__more_details' })}
          </Typography.Caption>
          <IconButton
            type="plain"
            name="ChevronDownOutline"
            size="xs"
            iconSize={16}
            onPress={() =>
              backgroundApiProxy.serviceSwap.setShowMoreQuoteDetail(true)
            }
          />
        </Box>
      ) : (
        <>
          {quote.needApproved ? <SwapExactAmoutAllowance /> : null}
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

            <Box
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
            >
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
              {intl.formatMessage({ id: 'form__swapping_via' })}
            </Typography.Caption>
            <Box
              flex="1"
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Pressable onPress={onSelectRoute}>
                <SwappingVia providers={quote.providers} />
              </Pressable>
              <Icon size={16} name="ChevronRightOutline" />
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
              <TransactionFee
                type={quote.type}
                percentageFee={quote.percentageFee}
              />
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
        </>
      )}
    </Box>
  );
};

export default SwapQuote;
