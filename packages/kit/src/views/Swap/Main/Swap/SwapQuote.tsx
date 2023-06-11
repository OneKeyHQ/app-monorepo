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

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation, useNetwork } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { setDisableSwapExactApproveAmount } from '../../../../store/reducers/settings';
import { showOverlay } from '../../../../utils/overlayUtils';
import { ArrivalTime } from '../../components/ArrivalTime';
import RefreshButton from '../../components/RefreshButton';
import { SwapLoadingSkeleton } from '../../components/Skeleton';
import SwappingVia from '../../components/SwappingVia';
import SwapTooltip from '../../components/SwapTooltip';
import TransactionFee from '../../components/TransactionFee';
import TransactionRate from '../../components/TransactionRate';
import {
  useSwapMinimumReceivedAmount,
  useSwapSlippage,
} from '../../hooks/useSwapUtils';
import { SwapRoutes } from '../../typings';
import {
  calculateProtocalsFee,
  formatAmount,
  getTokenAmountValue,
  normalizeProviderName,
} from '../../utils';

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
  const quote = useAppSelector((s) => s.swap.quote);
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

  if (!quote || !quote.needApproved) {
    return null;
  }
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-subdued" mr="1">
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
          <Typography.Body2 mr="1" color="text-default">
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
        <Typography.Body2 color="text-subdued" mr="1">
          {intl.formatMessage({ id: 'form__network_fee' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({ id: 'form__network_fee_desc' })}
        />
      </Box>
      <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
        <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
          <Typography.Body2 mr="1" color="text-default">
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
  const value = useSwapMinimumReceivedAmount();
  const outputToken = useAppSelector((s) => s.swap.outputToken);

  if (outputToken && value) {
    const amount = getTokenAmountValue(outputToken, String(value));
    return (
      <Typography.Body2 color="text-default">
        {amount.toFixed(4)} {outputToken.symbol.toUpperCase()}
      </Typography.Body2>
    );
  }
  return null;
};

const SwapPriceImpact = () => {
  const intl = useIntl();
  const quote = useAppSelector((s) => s.swap.quote);
  if (!quote) {
    return null;
  }

  const num = Number(quote.estimatedPriceImpact);
  if (num === 0 || Number.isNaN(num)) {
    return null;
  }
  const value = `${formatAmount(quote?.estimatedPriceImpact, 4)}%`;
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-subdued" mr="1">
          {intl.formatMessage({ id: 'title__price_impact' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({ id: 'form__price_impact_desc' })}
        />
      </Box>
      <Box flex="1" flexDirection="row" justifyContent="flex-end">
        <Typography.Body2 color="text-default">{value}</Typography.Body2>
      </Box>
    </Box>
  );
};

const SwapProtocalsFees = () => {
  const intl = useIntl();
  const protocolFees = useAppSelector((s) => s.swap.quote?.protocolFees);
  if (protocolFees) {
    const result = calculateProtocalsFee(protocolFees);
    if (Number(result.value) > 0) {
      return (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          h="9"
        >
          <Box flexDirection="row" alignItems="center">
            <Typography.Body2 color="text-subdued" mr="2">
              {intl.formatMessage({ id: 'form__bridge_fee' })}
            </Typography.Body2>
          </Box>
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
            <Typography.Body2 color="text-default">
              {`${formatAmount(
                result.value,
                8,
              )} ${result.symbol.toUpperCase()}`}
            </Typography.Body2>
          </Box>
        </Box>
      );
    }
  }
  return null;
};

const SwapSmartRoute = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const quote = useAppSelector((s) => s.swap.quote);
  const quoteLimited = useAppSelector((s) => s.swap.quoteLimited);
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
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Typography.Body2 color="text-subdued" mr="2">
        {intl.formatMessage({ id: 'form__smart_router' })}
      </Typography.Body2>
      <Box
        flex="1"
        flexDirection="row"
        justifyContent="flex-end"
        alignItems="center"
      >
        <SwapLoadingSkeleton h="5" width="24" borderRadius="4px">
          <Pressable
            onPress={onSelectRoute}
            disabled={!!quoteLimited}
            flexDirection="row"
            justifyContent="flex-end"
            alignItems="center"
          >
            <SwappingVia
              providers={quote.providers}
              typography="Body2"
              color="text-default"
            />
            {quoteLimited ? null : (
              <Icon size={16} name="ChevronRightOutline" />
            )}
          </Pressable>
        </SwapLoadingSkeleton>
      </Box>
    </Box>
  );
};

const SwapSlippage = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { mode, value: swapSlippagePercent } = useSwapSlippage();

  const onSlippageSetting = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.Slippage,
      },
    });
  }, [navigation]);

  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-subdued" mr="1">
          {intl.formatMessage({ id: 'title__slippage' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({ id: 'form__slippage_desc' })}
        />
      </Box>
      <Box flexDirection="row" justifyContent="flex-end" alignItems="center">
        <Pressable flexDirection="row" onPress={onSlippageSetting}>
          <Typography.Body2 mr="1" color="text-default">
            {mode === 'auto' ? intl.formatMessage({ id: 'form__auto' }) : null}(
            {swapSlippagePercent}%)
          </Typography.Body2>
          <Icon size={16} name="ChevronRightOutline" />
        </Pressable>
      </Box>
    </Box>
  );
};

const SwapOnekeyFee = () => {
  const intl = useIntl();
  const quote = useAppSelector((s) => s.swap.quote);
  if (!quote) {
    return null;
  }
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-subdued" mr="1">
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
          color="text-default"
        />
      </Box>
    </Box>
  );
};

const SwapArrivalTime = () => {
  const intl = useIntl();
  const arrivalTime = useAppSelector((s) => s.swap.quote?.arrivalTime);
  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      h="9"
    >
      <Box flexDirection="row" alignItems="center">
        <Typography.Body2 color="text-subdued" mr="1">
          {intl.formatMessage({ id: 'title__arrival_time' })}
        </Typography.Body2>
        <SwapTooltip
          label={intl.formatMessage({ id: 'form__arrival_time_desc' })}
        />
      </Box>
      <Box flex="1" flexDirection="row" justifyContent="flex-end">
        <ArrivalTime
          value={arrivalTime}
          typography="Body2"
          color="text-default"
        />
      </Box>
    </Box>
  );
};

const SwapAPIIntro = () => {
  const intl = useIntl();
  const quote = useAppSelector((s) => s.swap.quote);
  if (!quote) {
    return null;
  }
  return (
    <Box mt="2">
      <Divider />
      <Box py="4">
        <Typography.Caption color="text-subdued">
          {intl.formatMessage(
            {
              id: 'content__by_submitting_this_order_you_are_confirming_a_swap_powered_by_str_api',
            },
            { '0': normalizeProviderName(quote.type) },
          )}
        </Typography.Caption>
      </Box>
    </Box>
  );
};

const SwapTransactionRate = () => {
  const quote = useAppSelector((s) => s.swap.quote);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  if (quote) {
    return (
      <Center py="3">
        <SwapLoadingSkeleton h="5" width="24" borderRadius="4px">
          <Box flexDirection="row" alignItems="center">
            <Box mr="1">
              <RefreshButton />
            </Box>
            <TransactionRate
              tokenA={inputToken}
              tokenB={outputToken}
              rate={quote?.instantRate}
              typography="Body2"
              color="text-default"
            />
          </Box>
        </SwapLoadingSkeleton>
      </Center>
    );
  }
  return null;
};

const SwapExchangeQuote = () => {
  const intl = useIntl();
  const showMoreQuoteDetail = useAppSelector((s) => s.swap.showMoreQuoteDetail);
  return (
    <Box>
      <SwapTransactionRate />
      <SwapNetworkFeeInfo />
      <SwapSmartRoute />
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        h="9"
      >
        <Box flexDirection="row" alignItems="center">
          <Typography.Body2 color="text-subdued" mr="1">
            {intl.formatMessage({ id: 'form__minimum_received' })}
          </Typography.Body2>
          <SwapTooltip
            label={intl.formatMessage({
              id: 'form__minimum_received_desc',
            })}
          />
        </Box>
        <Box flex="1" flexDirection="row" justifyContent="flex-end">
          <SwapLoadingSkeleton h="5" width="24" borderRadius="4px">
            <SwapMinimumReceived />
          </SwapLoadingSkeleton>
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
          <SwapExactAmoutAllowance />
          <SwapSlippage />
          <SwapPriceImpact />
          <SwapProtocalsFees />
          <SwapOnekeyFee />
          <SwapArrivalTime />
        </>
      ) : null}
      <SwapAPIIntro />
    </Box>
  );
};

const SwapWrapperTxQuote = () => (
  <Box>
    <SwapNetworkFeeInfo />
  </Box>
);

export const SwapQuote = () => {
  const quote = useAppSelector((s) => s.swap.quote);
  if (!quote) {
    return null;
  }
  return quote.wrapperTxInfo ? <SwapWrapperTxQuote /> : <SwapExchangeQuote />;
};
