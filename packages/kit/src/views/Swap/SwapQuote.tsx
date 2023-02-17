import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  Divider,
  Icon,
  Pressable,
  Stack,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation, useNetwork } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { setDisableSwapExactApproveAmount } from '../../store/reducers/settings';
import { showOverlay } from '../../utils/overlayUtils';

import { ArrivalTime } from './components/ArrivalTime';
import SwappingVia from './components/SwappingVia';
import SwapTooltip from './components/SwapTooltip';
import TransactionFee from './components/TransactionFee';
import { usePriceImpact, useSwapSlippage } from './hooks/useSwapUtils';
import { SwapRoutes } from './typings';
import { getTokenAmountValue } from './utils';

const SwapProviders = () => {
  const intl = useIntl();
  const quote = useAppSelector((s) => s.swap.quote);
  if (!quote) {
    return null;
  }
  const normalize = (text: string) => {
    if (text === 'swftc') {
      return 'SWFT';
    }
    return text;
  };
  return (
    <Box mt="2">
      <Divider />
      <Box py="4">
        <Typography.Caption color="text-subdued">
          {intl.formatMessage(
            {
              id: 'content__by_submitting_this_order_you_are_confirming_a_swap_powered_by_str_api',
            },
            { '0': normalize(quote.type) },
          )}
        </Typography.Caption>
      </Box>
    </Box>
  );
};

const SwapArrivalTime = () => {
  const arrivalTime = useAppSelector((s) => s.swap.quote?.arrivalTime);
  return <ArrivalTime value={arrivalTime} typography="Body2" />;
};

const SwapExactAmountAllowanceBottomSheetModal: FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const intl = useIntl();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );
  const [isDisableSwapExactApproveAmount, setState] = useState(
    !!disableSwapExactApproveAmount,
  );
  return (
    <Stack direction="column" space="2">
      <Pressable
        _hover={{ bg: 'surface-hovered' }}
        px={4}
        py={2}
        borderRadius={12}
        _pressed={{ bg: 'surface-pressed' }}
        w="full"
        onPress={() => setState(false)}
      >
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__exact_amount' })}
        </Typography.Body1Strong>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Body1Strong color="text-subdued">
            {intl.formatMessage({
              id: 'content__approve_the_amount_to_tokens_to_be_sent',
            })}
          </Typography.Body1Strong>
          <Center w="5">
            {!isDisableSwapExactApproveAmount ? (
              <Icon name="CheckMini" size={20} color="text-success" />
            ) : null}
          </Center>
        </Box>
      </Pressable>
      <Pressable
        _hover={{ bg: 'surface-hovered' }}
        px={4}
        py={2}
        borderRadius={12}
        _pressed={{ bg: 'surface-pressed' }}
        w="full"
        onPress={() => setState(true)}
      >
        <Typography.Body1Strong>
          {intl.formatMessage({ id: 'form__unlimited' })}
        </Typography.Body1Strong>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Body1Strong color="text-subdued">
            {intl.formatMessage({
              id: 'content__you_dont_need _to_approve_again_in_the_future',
            })}
          </Typography.Body1Strong>
          <Center w="5">
            {isDisableSwapExactApproveAmount ? (
              <Icon name="CheckMini" size={20} color="text-success" />
            ) : null}
          </Center>
        </Box>
      </Pressable>
      <Button
        size="xl"
        type="primary"
        onPress={() => {
          backgroundApiProxy.dispatch(
            setDisableSwapExactApproveAmount(isDisableSwapExactApproveAmount),
          );
          onClose();
        }}
      >
        {intl.formatMessage({ id: 'action__done' })}
      </Button>
    </Stack>
  );
};

const SwapExactAmoutAllowance = () => {
  const intl = useIntl();
  const disableSwapExactApproveAmount = useAppSelector(
    (s) => s.settings.disableSwapExactApproveAmount,
  );

  const onPress = useCallback(() => {
    showOverlay((close) => (
      <BottomSheetModal
        title={intl.formatMessage({ id: 'form__approval' })}
        closeOverlay={close}
      >
        <SwapExactAmountAllowanceBottomSheetModal onClose={close} />
      </BottomSheetModal>
    ));
  }, [intl]);
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'form__approval' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({
            id: 'form__exact_amount_allowance_desc',
          })}
        />
      </Box>
      <Box
        flex="1"
        flexDirection="row"
        justifyContent="flex-end"
        alignItems="center"
      >
        <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
          <Typography.Body2 mr="1" color="text-subdued">
            {disableSwapExactApproveAmount
              ? intl.formatMessage({ id: 'form__unlimited' })
              : intl.formatMessage({ id: 'form__exact_amount' })}
          </Typography.Body2>
          <Icon size={16} name="ChevronRightOutline" />
        </Pressable>
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
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'form__network_fee' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({ id: 'form__network_fee_desc' })}
        />
      </Box>
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
  const { value: swapSlippagePercent } = useSwapSlippage();
  if (outputToken && buyAmount) {
    const bn = getTokenAmountValue(outputToken, buyAmount);
    const value = bn.minus(bn.multipliedBy(Number(swapSlippagePercent) / 100));
    return (
      <Typography.Body2 color="text-subdued">
        {value.toFixed(4)} {outputToken.symbol.toUpperCase()}
      </Typography.Body2>
    );
  }
  return null;
};

const SwapPriceImpact = () => {
  const priceImpact = usePriceImpact();
  if (priceImpact) {
    return (
      <Typography.Body2 color="text-subdued">
        -{Number(priceImpact).toFixed(2)}%
      </Typography.Body2>
    );
  }
  return <Typography.Body2 color="text-subdued">&lt;0.01%</Typography.Body2>;
};

const SwapQuote = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const quote = useAppSelector((s) => s.swap.quote);
  const quoteLimited = useAppSelector((s) => s.swap.quoteLimited);

  const showMoreQuoteDetail = useAppSelector((s) => s.swap.showMoreQuoteDetail);
  const { mode, value: swapSlippagePercent } = useSwapSlippage();

  const onSlippageSetting = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Slippage,
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
      <SwapNetworkFeeInfo />
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="9"
      >
        <Typography.Body2 color="text-disabled" mr="2">
          {intl.formatMessage({ id: 'form__smart_router' })}
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
          {quoteLimited ? null : <Icon size={16} name="ChevronRightOutline" />}
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="9"
      >
        <Box flexDirection="row" alignItems="center">
          <Typography.Body2 color="text-disabled" mr="2">
            {intl.formatMessage({ id: 'form__minimum_received' })}
          </Typography.Body2>
          <SwapTooltip
            label={intl.formatMessage({
              id: 'form__minimum_received_desc',
            })}
          />
        </Box>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <SwapMinimumReceived />
        </Box>
      </Box>
      <Center h="9">
        {!showMoreQuoteDetail ? (
          <Button
            iconColor="text-subdued"
            rightIconName="ChevronDownMini"
            _text={{ color: 'text-subdued' }}
            type="plain"
            onPress={() =>
              backgroundApiProxy.serviceSwap.setShowMoreQuoteDetail(true)
            }
          >
            {intl.formatMessage({ id: 'action__expand' })}
          </Button>
        ) : (
          <Button
            iconColor="text-subdued"
            rightIconName="ChevronUpMini"
            _text={{ color: 'text-subdued' }}
            type="plain"
            onPress={() =>
              backgroundApiProxy.serviceSwap.setShowMoreQuoteDetail(false)
            }
          >
            {intl.formatMessage({ id: 'action__collapse' })}
          </Button>
        )}
      </Center>
      {showMoreQuoteDetail ? (
        <>
          {quote.needApproved ? <SwapExactAmoutAllowance /> : null}
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Body2 color="text-disabled" mr="2">
                {intl.formatMessage({ id: 'title__slippage' })}
              </Typography.Body2>
              <SwapTooltip
                label={intl.formatMessage({ id: 'form__slippage_desc' })}
              />
            </Box>
            <Box
              flexDirection="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              <Pressable flexDirection="row" onPress={onSlippageSetting}>
                <Typography.Body2 mr="1" color="text-subdued">
                  {mode === 'auto'
                    ? intl.formatMessage({ id: 'form__auto' })
                    : null}
                  ({swapSlippagePercent}%)
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
            h="9"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Body2 color="text-disabled" mr="2">
                {intl.formatMessage({ id: 'title__price_impact' })}
              </Typography.Body2>
              <SwapTooltip
                label={intl.formatMessage({ id: 'form__price_impact_desc' })}
              />
            </Box>

            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <SwapPriceImpact />
            </Box>
          </Box>
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            h="9"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Body2 color="text-disabled" mr="2">
                {intl.formatMessage({ id: 'form__included_onekey_fee' })}
              </Typography.Body2>
              <SwapTooltip
                label={intl.formatMessage({
                  id: 'form__included_onekey_fee_desc',
                })}
              />
            </Box>

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
            h="9"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Body2 color="text-disabled" mr="2">
                {intl.formatMessage({ id: 'title__arrival_time' })}
              </Typography.Body2>
              <SwapTooltip
                label={intl.formatMessage({ id: 'form__arrival_time_desc' })}
              />
            </Box>
            <Box flex="1" flexDirection="row" justifyContent="flex-end">
              <SwapArrivalTime />
            </Box>
          </Box>
        </>
      ) : null}
      <SwapProviders />
    </Box>
  );
};

export default SwapQuote;
