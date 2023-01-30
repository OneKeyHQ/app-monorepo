import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  CustomSkeleton,
  Icon,
  IconButton,
  Pressable,
  Stack,
  Switch,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation, useNetwork } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setDisableSwapExactApproveAmount } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import { ArrivalTime } from './components/ArrivalTime';
import SwappingVia from './components/SwappingVia';
import TransactionFee from './components/TransactionFee';
import TransactionRate from './components/TransactionRate';
import { useTokenPrice } from './hooks/useSwapTokenUtils';
import { SwapRoutes } from './typings';
import { div, getTokenAmountValue, lte, minus, multiply } from './utils';

const SwapArrivalTime = () => {
  const arrivalTime = useAppSelector((s) => s.swap.quote?.arrivalTime);
  return <ArrivalTime value={arrivalTime} typography="Body2" />;
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
      <Typography.Body2 color="text-disabled" mr="2">
        {intl.formatMessage({ id: 'form__exact_amount_allowance' })}
      </Typography.Body2>
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

const SwapNetworkFeeEditable = () => {
  const intl = useIntl();
  const fees = useMemo(
    () => [
      { text: intl.formatMessage({ id: 'form__rocket_rapid' }), value: '2' },
      { text: intl.formatMessage({ id: 'form__train_fast' }), value: '1' },
      { text: intl.formatMessage({ id: 'form__car_normal' }), value: '0' },
    ],
    [intl],
  );

  const swapFeePresetIndex = useAppSelector(
    (s) => s.swapTransactions.swapFeePresetIndex,
  );

  const onPress = useCallback(() => {
    showOverlay((close) => (
      <BottomSheetModal
        title={intl.formatMessage({ id: 'form__gas_fee_settings' })}
        closeOverlay={close}
      >
        <Stack direction="column" space="2">
          {fees.map((item) => (
            <Pressable
              _hover={{ bg: 'surface-hovered' }}
              px={4}
              py={2}
              borderRadius={12}
              _pressed={{ bg: 'surface-pressed' }}
              w="full"
              key={item.value}
              onPress={() => {
                backgroundApiProxy.serviceSwap.setSwapFeePresetIndex(
                  item.value,
                );
                close();
              }}
            >
              <Typography.DisplayMedium>{item.text}</Typography.DisplayMedium>
            </Pressable>
          ))}
        </Stack>
      </BottomSheetModal>
    ));
  }, [fees, intl]);

  const text = useMemo(() => {
    let index = fees.findIndex((item) => item.value === swapFeePresetIndex);
    if (index === -1) {
      // default network fee is fast
      index = 1;
    }
    return fees[index].text;
  }, [fees, swapFeePresetIndex]);

  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      mb="4"
    >
      <Typography.Body2 color="text-disabled" mr="2">
        {intl.formatMessage({ id: 'form__network_fee' })}
      </Typography.Body2>
      <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
        <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
          <Typography.Body2 mr="1" color="text-subdued">
            {text}
          </Typography.Body2>
          <Icon size={16} name="ChevronRightOutline" />
        </Pressable>
      </Box>
    </Box>
  );
};

const SwapNetworkFeeInfo = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const { network } = useNetwork({ networkId: inputToken?.networkId });
  return network?.settings?.feeInfoEditable ? <SwapNetworkFeeEditable /> : null;
};

const SwapMinimumReceived = () => {
  const buyAmount = useAppSelector(
    (s) => s.swap.quote?.estimatedBuyAmount || s.swap.quote?.buyAmount,
  );
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  if (outputToken && buyAmount) {
    return (
      <Typography.Body2 color="text-subdued">
        {getTokenAmountValue(outputToken, buyAmount).toFixed(4)}{' '}
        {outputToken.symbol.toUpperCase()}
      </Typography.Body2>
    );
  }
  return null;
};

const SwapPriceImpact = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const inputPrice = useTokenPrice(inputToken);
  const outputPrice = useTokenPrice(outputToken);
  const instantRate = useAppSelector((s) => s.swap.quote?.instantRate);
  if (outputPrice && inputPrice && instantRate) {
    const rate = div(inputPrice, outputPrice);
    if (lte(instantRate, rate)) {
      const percent = multiply(div(minus(rate, instantRate), rate), 100);
      return (
        <Typography.Body2 color="text-subdued">
          -{Number(percent).toFixed(2)}%
        </Typography.Body2>
      );
    }
  }
  return <Typography.Body2 color="text-subdued">&lt;0.01%</Typography.Body2>;
};

const SwapQuote = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const quote = useAppSelector((s) => s.swap.quote);
  const quoteLimited = useAppSelector((s) => s.swap.quoteLimited);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const loading = useAppSelector((s) => s.swap.loading);
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
        <Typography.Body2 color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'Rate' })}
        </Typography.Body2>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          {loading ? (
            <Box h="4" width="24" borderRadius="2px" overflow="hidden">
              <CustomSkeleton />
            </Box>
          ) : (
            <Box maxW="full">
              <TransactionRate
                tokenA={inputToken}
                tokenB={outputToken}
                rate={quote?.instantRate}
                typography="Body2"
                color="text-subdued"
              />
            </Box>
          )}
        </Box>
      </Box>
      <SwapNetworkFeeInfo />
      {!showMoreQuoteDetail ? (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mb="4"
        >
          <Typography.Body2 color="text-disabled" mr="2">
            {intl.formatMessage({ id: 'form__more_details' })}
          </Typography.Body2>
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
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'title__slippage' })}
            </Typography.Body2>

            <Box
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Pressable flexDirection="row" onPress={onSettting}>
                <Typography.Body2 mr="1" color="text-subdued">
                  Auto({swapSlippagePercent}%)
                </Typography.Body2>
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
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'form__swapping_via' })}
            </Typography.Body2>
            <Box
              flex="1"
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Pressable onPress={onSelectRoute} disabled={!!quoteLimited}>
                <SwappingVia providers={quote.providers} typography="Body2" />
              </Pressable>
              {quoteLimited ? null : (
                <Icon size={16} name="ChevronRightOutline" />
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
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'title__price_impact' })}
            </Typography.Body2>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <SwapPriceImpact />
            </Box>
          </Box>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            mb="4"
          >
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'form__included_onekey_fee' })}
            </Typography.Body2>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <TransactionFee
                type={quote.type}
                percentageFee={quote.percentageFee}
                typography="Body2"
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
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'form__minimum_received' })}
            </Typography.Body2>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <SwapMinimumReceived />
            </Box>
          </Box>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            mb="4"
          >
            <Typography.Body2 color="text-disabled" mr="2">
              {intl.formatMessage({ id: 'title__arrival_time' })}
            </Typography.Body2>
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
