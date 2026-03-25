import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Alert,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  Popover,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import SlippageSettingDialog from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { StakingAmountInput } from '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput';
import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowTransactionConfirmation,
  ICheckAmountAlert,
  IEarnText,
  IRepayWithCollateralQuote,
} from '@onekeyhq/shared/types/staking';
import { swapSlippageAutoValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import { BorrowInfoItem } from './BorrowInfoItem';
import { ManagePosition } from './ManagePosition';
import { useAmountInput } from './ManagePosition/hooks/useAmountInput';
import { useTokenSelector } from './ManagePosition/hooks/useTokenSelector';
import { HealthFactorInfo } from './ManagePosition/modules/InfoDisplaySection/HealthFactorInfo';
import { PositionInfo } from './ManagePosition/modules/InfoDisplaySection/PositionInfo';

import type { IManagePositionProps } from './ManagePosition';

export type IRepayCollateralAsset = {
  reserveAddress: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
  };
  supplied: {
    title: IEarnText;
    description: IEarnText;
  };
};

export type IRepayWithCollateralConfirmParams = {
  amount: string;
  collateralReserveAddress: string;
  repayAll?: boolean;
  slippageBps: number;
  routeKey?: string;
  collateralAmount?: string;
  collateralAsset: IRepayCollateralAsset;
};

type IBorrowRepayPositionProps = Omit<
  IManagePositionProps,
  'action' | 'onConfirm'
> & {
  onWalletConfirm?: IManagePositionProps['onConfirm'];
  onRepayWithCollateralConfirm: (
    params: IRepayWithCollateralConfirmParams,
  ) => Promise<void>;
  collateralAssets: IRepayCollateralAsset[];
  collateralLoading?: boolean;
  defaultCollateralReserveAddress?: string;
  debtBalance?: string;
};

type IRepayMode = 'wallet' | 'collateral';

const ARROW_OVERLAY_OFFSET = -13;
const ENABLE_COLLATERAL_REPAY_ENTRY = false;

function CollateralSelectContent({
  assets,
  selectedReserveAddress,
  onSelect,
  closePopover,
}: {
  assets: IRepayCollateralAsset[];
  selectedReserveAddress?: string;
  onSelect: (asset: IRepayCollateralAsset) => void;
  closePopover: () => void;
}) {
  const intl = useIntl();

  return (
    <YStack p="$2">
      <XStack px="$3" pb="$1" justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_available })}
        </SizableText>
      </XStack>
      {assets.map((item) => {
        const isSelected = item.reserveAddress === selectedReserveAddress;
        return (
          <XStack
            key={item.reserveAddress}
            py="$2"
            px="$3"
            gap="$3"
            alignItems="center"
            justifyContent="space-between"
            hoverStyle={isSelected ? undefined : { bg: '$bgHover' }}
            pressStyle={isSelected ? undefined : { bg: '$bgActive' }}
            bg={isSelected ? '$bgHover' : undefined}
            borderRadius="$2"
            cursor={isSelected ? 'default' : 'pointer'}
            onPress={
              isSelected
                ? undefined
                : () => {
                    onSelect(item);
                    closePopover();
                  }
            }
          >
            <XStack alignItems="center" gap="$2.5">
              <Image
                size="$8"
                borderRadius="$full"
                source={{ uri: item.token.logoURI }}
              />
              <SizableText size="$bodyMdMedium">
                {item.token.symbol}
              </SizableText>
            </XStack>
            <YStack alignItems="flex-end">
              <EarnText text={item.supplied.title} size="$bodyMd" />
              <EarnText
                text={item.supplied.description}
                size="$bodySm"
                color="$textSubdued"
              />
            </YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}

function createCollateralSelectPopoverContent({
  assets,
  selectedReserveAddress,
  onSelect,
}: {
  assets: IRepayCollateralAsset[];
  selectedReserveAddress?: string;
  onSelect: (asset: IRepayCollateralAsset) => void;
}) {
  return function CollateralPopoverContent({
    closePopover,
  }: {
    isOpen?: boolean;
    closePopover: () => void;
  }) {
    return (
      <CollateralSelectContent
        assets={assets}
        selectedReserveAddress={selectedReserveAddress}
        onSelect={onSelect}
        closePopover={closePopover}
      />
    );
  };
}

function RemainingCollateralInfo({
  data,
}: {
  data: NonNullable<IBorrowTransactionConfirmation['remainingCollateral']>;
}) {
  if (!data.title?.text || !data.description?.text) {
    return null;
  }

  return (
    <BorrowInfoItem title={data.title.text}>
      <YStack alignItems="flex-end">
        <SizableText size="$bodyMdMedium">{data.description.text}</SizableText>
      </YStack>
    </BorrowInfoItem>
  );
}

function RepayWithCollateralForm({
  accountId,
  networkId,
  providerName,
  borrowMarketAddress,
  borrowReserveAddress,
  balance: _walletBalance,
  maxBalance: _walletMaxBalance,
  debtBalance,
  decimals,
  price,
  tokenSymbol,
  tokenImageUri,
  selectableAssets,
  selectableAssetsLoading,
  onTokenSelect,
  isDisabled,
  beforeFooter,
  isInModalContext = true,
  collateralAssets,
  collateralLoading,
  defaultCollateralReserveAddress,
  onRepayWithCollateralConfirm,
}: Omit<IBorrowRepayPositionProps, 'onWalletConfirm'>) {
  // For collateral repay, use debt balance (how much user owes)
  // Fall back to wallet maxBalance (which is also debt) for backward compatibility
  const balance = debtBalance ?? _walletMaxBalance ?? _walletBalance;
  const maxBalance = debtBalance;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;
  const [amountValue, setAmountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<IRepayWithCollateralQuote | undefined>();
  const [transactionConfirmation, setTransactionConfirmation] = useState<
    IBorrowTransactionConfirmation | undefined
  >();
  const [checkAmountMessage, setCheckAmountMessage] = useState('');
  const [checkAmountAlerts, setCheckAmountAlerts] = useState<
    ICheckAmountAlert[]
  >([]);
  const [checkAmountLoading, setCheckAmountLoading] = useState(false);
  const [checkAmountResult, setCheckAmountResult] = useState<
    boolean | undefined
  >();
  const [selectedCollateral, setSelectedCollateral] = useState<
    IRepayCollateralAsset | undefined
  >();
  const [slippage, setSlippage] = useState<ISwapSlippageSegmentItem>({
    key: ESwapSlippageSegmentKey.AUTO,
    value: swapSlippageAutoValue,
  });
  const repayRequestKeyRef = useRef('');
  const checkAmountRequestKeyRef = useRef('');
  const [
    {
      currencyInfo: { symbol: currencySymbol },
    },
  ] = useSettingsPersistAtom();

  useEffect(() => {
    if (!collateralAssets.length) {
      setSelectedCollateral(undefined);
      return;
    }

    setSelectedCollateral((prev) => {
      const preferred =
        prev?.reserveAddress ||
        defaultCollateralReserveAddress ||
        collateralAssets[0].reserveAddress;
      return (
        collateralAssets.find((item) => item.reserveAddress === preferred) ??
        collateralAssets[0]
      );
    });
  }, [collateralAssets, defaultCollateralReserveAddress]);

  const {
    onChangeAmountValue,
    onMax,
    onSelectPercentageStage,
    onBlurAmountValue,
  } = useAmountInput({
    action: 'repay',
    decimals,
    balance,
    maxBalance,
    amountValue,
    setAmountValue,
  });

  const { tokenSelectorTriggerProps } = useTokenSelector({
    action: 'repay',
    accountId,
    networkId,
    providerName,
    borrowMarketAddress,
    borrowReserveAddress,
    tokenSymbol,
    tokenImageUri,
    selectableAssets,
    selectableAssetsLoading,
    onTokenSelect,
    setAmountValue,
  });

  const normalizedAmount = useMemo(() => {
    if (!amountValue) {
      return '0';
    }
    const amountBN = new BigNumber(amountValue);
    if (amountBN.isNaN() || amountValue.endsWith('.')) {
      return '0';
    }
    return amountBN.toFixed();
  }, [amountValue]);

  const currentValue = useMemo(() => {
    const amountBN = new BigNumber(amountValue || '0');
    const priceBN = new BigNumber(price || '0');
    if (
      amountBN.isNaN() ||
      priceBN.isNaN() ||
      amountBN.lte(0) ||
      priceBN.lte(0)
    ) {
      return undefined;
    }
    return amountBN.multipliedBy(priceBN).toFixed();
  }, [amountValue, price]);

  const isRepayAll = useMemo(() => {
    const amountBN = new BigNumber(normalizedAmount);
    const balanceBN = new BigNumber(balance || '0');
    return amountBN.gt(0) && !balanceBN.isNaN() && amountBN.eq(balanceBN);
  }, [balance, normalizedAmount]);

  const slippageBps = useMemo(
    () =>
      new BigNumber(slippage.value || 0)
        .times(100)
        .integerValue(BigNumber.ROUND_HALF_UP)
        .toNumber(),
    [slippage.value],
  );

  const repayRequestKey = useMemo(() => {
    const amountBN = new BigNumber(normalizedAmount);
    if (!selectedCollateral || amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    return [
      normalizedAmount,
      selectedCollateral.reserveAddress,
      isRepayAll ? '1' : '0',
      slippageBps,
    ].join(':');
  }, [isRepayAll, normalizedAmount, selectedCollateral, slippageBps]);

  const checkAmountRequestKey = useMemo(() => {
    const amountBN = new BigNumber(normalizedAmount);
    if (!selectedCollateral || amountBN.isNaN() || amountBN.lte(0)) {
      return '';
    }

    return [
      normalizedAmount,
      selectedCollateral.reserveAddress,
      isRepayAll ? '1' : '0',
    ].join(':');
  }, [isRepayAll, normalizedAmount, selectedCollateral]);

  const displaySlippageText = useMemo(() => {
    if (slippage.key === ESwapSlippageSegmentKey.AUTO) {
      return `${intl.formatMessage({
        id: ETranslations.slippage_tolerance_switch_auto,
      })} (${slippage.value}%)`;
    }

    return `${slippage.value}%`;
  }, [intl, slippage]);

  const handleOpenSlippage = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.slippage_tolerance_title,
      }),
      renderContent: (
        <SlippageSettingDialog
          swapSlippage={slippage}
          autoValue={swapSlippageAutoValue}
          onSave={(item, close) => {
            setSlippage(item);
            void close({ flag: 'save' });
          }}
          isMEV={false}
        />
      ),
    });
  }, [intl, slippage]);

  const debouncedFetchQuote = useDebouncedCallback(
    async (
      value: string,
      collateralReserveAddress: string,
      repayAll: boolean,
      currentSlippageBps: number,
      requestKey: string,
    ) => {
      if (repayRequestKeyRef.current !== requestKey) {
        return;
      }

      const amountBN = new BigNumber(value || '0');
      if (amountBN.isNaN() || amountBN.lte(0)) {
        return;
      }

      try {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowRepayWithCollateralQuote(
            {
              accountId,
              networkId,
              provider: providerName,
              marketAddress: borrowMarketAddress,
              reserveAddress: borrowReserveAddress,
              collateralReserveAddress,
              amount: value,
              repayAll,
              slippageBps: currentSlippageBps,
            },
          );
        if (repayRequestKeyRef.current === requestKey) {
          setQuote(resp);
        }
      } catch {
        if (repayRequestKeyRef.current === requestKey) {
          setQuote(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchQuote.cancel();
    repayRequestKeyRef.current = repayRequestKey;
    setQuote(undefined);

    if (!repayRequestKey || !selectedCollateral) {
      return;
    }

    void debouncedFetchQuote(
      normalizedAmount,
      selectedCollateral.reserveAddress,
      isRepayAll,
      slippageBps,
      repayRequestKey,
    );
    return () => {
      debouncedFetchQuote.cancel();
    };
  }, [
    debouncedFetchQuote,
    isRepayAll,
    normalizedAmount,
    repayRequestKey,
    selectedCollateral,
    slippageBps,
  ]);

  const debouncedFetchConfirmation = useDebouncedCallback(
    async (
      value: string,
      collateralReserveAddress: string,
      currentSlippageBps: number,
      requestKey: string,
    ) => {
      if (repayRequestKeyRef.current !== requestKey) {
        return;
      }

      try {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
            {
              accountId,
              networkId,
              provider: providerName,
              marketAddress: borrowMarketAddress,
              reserveAddress: borrowReserveAddress,
              action: 'repayWithCollateral',
              amount: value,
              collateralReserveAddress,
              slippageBps: currentSlippageBps,
            },
          );
        if (repayRequestKeyRef.current === requestKey) {
          setTransactionConfirmation(resp);
        }
      } catch {
        if (repayRequestKeyRef.current === requestKey) {
          setTransactionConfirmation(undefined);
        }
      }
    },
    350,
  );

  useEffect(() => {
    debouncedFetchConfirmation.cancel();
    repayRequestKeyRef.current = repayRequestKey;
    setTransactionConfirmation(undefined);

    if (!repayRequestKey || !selectedCollateral) {
      return;
    }

    void debouncedFetchConfirmation(
      normalizedAmount,
      selectedCollateral.reserveAddress,
      slippageBps,
      repayRequestKey,
    );
    return () => {
      debouncedFetchConfirmation.cancel();
    };
  }, [
    debouncedFetchConfirmation,
    normalizedAmount,
    repayRequestKey,
    selectedCollateral,
    slippageBps,
  ]);

  const debouncedCheckAmount = useDebouncedCallback(
    async (
      value: string,
      collateralReserveAddress: string,
      repayAll: boolean,
      requestKey: string,
    ) => {
      if (checkAmountRequestKeyRef.current !== requestKey) {
        return;
      }

      setCheckAmountLoading(true);
      try {
        const resp =
          await backgroundApiProxy.serviceStaking.getBorrowCheckAmount({
            accountId,
            networkId,
            provider: providerName,
            marketAddress: borrowMarketAddress,
            reserveAddress: borrowReserveAddress,
            action: 'repayWithCollateral',
            amount: value,
            repayAll,
            collateralReserveAddress,
          });

        if (checkAmountRequestKeyRef.current !== requestKey) {
          return;
        }

        if (Number(resp.code) === 0) {
          setCheckAmountMessage('');
          setCheckAmountAlerts(resp.data?.alerts ?? []);
          setCheckAmountResult(resp.data?.result);
        } else {
          setCheckAmountMessage(resp.message);
          setCheckAmountAlerts([]);
          setCheckAmountResult(false);
        }
      } finally {
        if (checkAmountRequestKeyRef.current === requestKey) {
          setCheckAmountLoading(false);
        }
      }
    },
    300,
  );

  useEffect(() => {
    debouncedCheckAmount.cancel();
    checkAmountRequestKeyRef.current = checkAmountRequestKey;
    setCheckAmountMessage('');
    setCheckAmountAlerts([]);
    setCheckAmountResult(undefined);
    setCheckAmountLoading(false);

    if (!checkAmountRequestKey || !selectedCollateral) {
      return;
    }

    void debouncedCheckAmount(
      normalizedAmount,
      selectedCollateral.reserveAddress,
      isRepayAll,
      checkAmountRequestKey,
    );
    return () => {
      debouncedCheckAmount.cancel();
    };
  }, [
    checkAmountRequestKey,
    debouncedCheckAmount,
    isRepayAll,
    normalizedAmount,
    selectedCollateral,
  ]);

  const isCheckAmountMessageError = useMemo(
    () => amountValue.length > 0 && !!checkAmountMessage,
    [amountValue.length, checkAmountMessage],
  );

  const isAmountInvalid = useMemo(
    () =>
      BigNumber(amountValue || '0').isNaN() ||
      (typeof amountValue === 'string' && amountValue.endsWith('.')),
    [amountValue],
  );

  const isButtonDisabled = useMemo(() => {
    const amountBN = new BigNumber(normalizedAmount);
    return (
      !!isDisabled ||
      isAmountInvalid ||
      amountBN.lte(0) ||
      !selectedCollateral ||
      !quote?.swapIn ||
      isCheckAmountMessageError ||
      checkAmountResult === false ||
      checkAmountLoading
    );
  }, [
    checkAmountLoading,
    checkAmountResult,
    isCheckAmountMessageError,
    isAmountInvalid,
    isDisabled,
    normalizedAmount,
    quote?.swapIn,
    selectedCollateral,
  ]);

  const collateralPopoverTitle = useMemo(
    () => intl.formatMessage({ id: ETranslations.token_selector_title }),
    [intl],
  );

  const collateralTrigger = useMemo(() => {
    if (!selectedCollateral) {
      if (collateralLoading) {
        return (
          <XStack
            alignItems="center"
            m="$1.5"
            mb="$0"
            p="$2"
            borderRadius="$2"
            maxWidth="$44"
          >
            <Skeleton w="$7" h="$7" mr="$2" radius="round" />
            <Skeleton w="$16" h="$6" />
          </XStack>
        );
      }
      return null;
    }

    const content = (
      <XStack
        alignItems="center"
        m="$1.5"
        mb="$0"
        p="$2"
        borderRadius="$2"
        userSelect="none"
        maxWidth="$44"
      >
        <Image
          mr="$2"
          size="$7"
          borderRadius="$full"
          source={{ uri: selectedCollateral.token.logoURI }}
        />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {selectedCollateral.token.symbol}
        </SizableText>
        {collateralAssets.length > 1 ? (
          <Icon
            flexShrink={0}
            name="ChevronDownSmallOutline"
            size="$5"
            mr="$-1"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    );

    if (collateralAssets.length <= 1) {
      return content;
    }

    return (
      <Popover
        title={collateralPopoverTitle}
        renderTrigger={content}
        floatingPanelProps={{ w: '$72' }}
        renderContent={createCollateralSelectPopoverContent({
          assets: collateralAssets,
          selectedReserveAddress: selectedCollateral.reserveAddress,
          onSelect: setSelectedCollateral,
        })}
      />
    );
  }, [
    collateralAssets,
    collateralLoading,
    collateralPopoverTitle,
    selectedCollateral,
  ]);

  const usingAmountText = useMemo(() => quote?.swapIn ?? '0', [quote?.swapIn]);

  const priceImpactInfo = useMemo(() => {
    if (!quote?.maxPriceImpact) {
      return undefined;
    }
    const impactPct = new BigNumber(quote.maxPriceImpact);
    if (impactPct.isNaN()) {
      return undefined;
    }
    const pctFormatted = `${impactPct.toFixed(2)}%`;
    // Debt repayment fiat value = swapIn (collateral) × fillPrice (debt per collateral) × debtTokenPrice
    const swapInBN = new BigNumber(quote.swapIn || '0');
    const fillPriceBN = new BigNumber(quote.fillPrice || '0');
    const priceBN = new BigNumber(price || '0');
    if (swapInBN.lte(0) || fillPriceBN.lte(0) || priceBN.lte(0)) {
      return { pctFormatted };
    }
    const fiatValue = swapInBN
      .multipliedBy(fillPriceBN)
      .multipliedBy(priceBN)
      .toFixed();
    return { fiatValue, pctFormatted };
  }, [quote?.maxPriceImpact, quote?.swapIn, quote?.fillPrice, price]);

  const quoteSummary = useMemo(() => {
    if (
      !quote?.fillPrice ||
      !selectedCollateral?.token.symbol ||
      !tokenSymbol
    ) {
      return undefined;
    }
    return `1 ${selectedCollateral.token.symbol} = ${quote.fillPrice} ${tokenSymbol}`;
  }, [quote?.fillPrice, selectedCollateral?.token.symbol, tokenSymbol]);

  const handleSubmit = async () => {
    if (!selectedCollateral) {
      return;
    }
    try {
      setSubmitting(true);
      await onRepayWithCollateralConfirm({
        amount: normalizedAmount,
        collateralReserveAddress: selectedCollateral.reserveAddress,
        repayAll: isRepayAll,
        slippageBps,
        routeKey: quote?.routeKey,
        collateralAmount: quote?.swapIn,
        collateralAsset: selectedCollateral,
      });
      setAmountValue('');
    } finally {
      setSubmitting(false);
    }
  };

  const arrowOverlayStyle = useMemo(() => {
    if (!platformEnv.isNative) {
      return { transform: 'translate(-50%, -50%)' as const };
    }

    return {
      transform: [
        { translateX: ARROW_OVERLAY_OFFSET },
        { translateY: ARROW_OVERLAY_OFFSET },
      ] as const,
    };
  }, []);

  return (
    <>
      <StakingFormWrapper>
        <YStack gap="$3">
          <Stack position="relative" opacity={isDisabled ? 0.7 : 1}>
            <StakingAmountInput
              title={intl.formatMessage({ id: ETranslations.defi_repay })}
              disabled={!!isDisabled}
              hasError={isCheckAmountMessageError}
              value={amountValue}
              onChange={onChangeAmountValue}
              onBlur={onBlurAmountValue}
              tokenSelectorTriggerProps={tokenSelectorTriggerProps}
              inputProps={{
                placeholder: '0',
                autoFocus: !isDisabled,
              }}
              balanceProps={{
                value: balance,
                iconText: intl.formatMessage({
                  id: ETranslations.defi_borrow_repay_remaining_debt,
                }),
                onPress: isDisabled ? undefined : onMax,
              }}
              valueProps={{
                value: currentValue,
                currency: currentValue ? currencySymbol : undefined,
              }}
              enableMaxAmount
              maxAmountText={intl.formatMessage({
                id: ETranslations.global_max,
              })}
              onSelectPercentageStage={onSelectPercentageStage}
            />
            <Stack mt="$2">
              <YStack borderRadius="$3" bg="$bgSubdued">
                <XStack justifyContent="space-between" pt="$2.5" px="$3.5">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.global_pay,
                    })}
                  </SizableText>
                </XStack>
                <XStack alignItems="center" justifyContent="space-between">
                  <Stack flex={1} px="$3.5" pt="$3" pb="$2.5">
                    <SizableText size="$heading3xl">
                      {usingAmountText}
                    </SizableText>
                  </Stack>
                  {collateralTrigger}
                </XStack>
                <XStack
                  px="$3.5"
                  pb="$2"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  {priceImpactInfo?.fiatValue ? (
                    <SizableText size="$bodySm" color="$textSubdued">
                      <NumberSizeableText
                        size="$bodySm"
                        color="$textSubdued"
                        formatter="value"
                        formatterOptions={{
                          currency: currencySymbol,
                        }}
                      >
                        {priceImpactInfo.fiatValue}
                      </NumberSizeableText>
                      {` (${priceImpactInfo.pctFormatted})`}
                    </SizableText>
                  ) : (
                    <SizableText size="$bodySm" color="$textSubdued">
                      {priceImpactInfo?.pctFormatted ?? '-'}
                    </SizableText>
                  )}
                  {selectedCollateral ? (
                    <EarnText
                      text={{
                        ...selectedCollateral.supplied.title,
                        text: `${intl.formatMessage({
                          id: ETranslations.global_available,
                        })} ${selectedCollateral.supplied.title.text ?? ''}`,
                      }}
                      size="$bodySm"
                      color="$textSubdued"
                    />
                  ) : null}
                </XStack>
              </YStack>
            </Stack>

            <Stack
              ai="center"
              position="absolute"
              top="50%"
              left="50%"
              zIndex={2}
              pointerEvents="none"
              style={arrowOverlayStyle}
            >
              <IconButton
                alignSelf="center"
                bg="$bgApp"
                variant="tertiary"
                icon="ArrowTopOutline"
                iconProps={{
                  color: '$icon',
                }}
                size="small"
                disabled
                opacity={1}
              />
            </Stack>
          </Stack>

          {isCheckAmountMessageError ? (
            <Alert
              icon="InfoCircleOutline"
              type="critical"
              title={checkAmountMessage}
            />
          ) : null}

          {checkAmountAlerts.length > 0
            ? checkAmountAlerts.map((alert, index) => (
                <Alert
                  key={`${alert.type}-${index}`}
                  type={alert.type}
                  renderTitle={() => (
                    <YStack>
                      <EarnText text={alert.title} size="$bodyMdMedium" />
                      <EarnText text={alert.text} size="$bodyMdMedium" />
                      <EarnText text={alert.description} size="$bodyMdMedium" />
                    </YStack>
                  )}
                  action={
                    alert.button
                      ? {
                          primary: alert.button.text.text,
                          onPrimaryPress: () => {
                            if (alert.button?.data?.link) {
                              handleOpenWebSite({
                                navigation,
                                useCurrentWindow: false,
                                webSite: {
                                  url: alert.button.data.link,
                                  title: alert.button.data.link,
                                  logo: undefined,
                                  sortIndex: undefined,
                                },
                              });
                            }
                          },
                        }
                      : undefined
                  }
                />
              ))
            : null}

          <YStack
            p="$3.5"
            pt="$5"
            borderRadius="$3"
            borderWidth={1}
            borderColor="$borderSubdued"
            gap="$5"
          >
            {quoteSummary ? (
              <>
                <BorrowInfoItem
                  title={
                    <EarnText
                      text={{ text: quoteSummary }}
                      color="$text"
                      size="$bodyMdMedium"
                    />
                  }
                />
                <Divider />
              </>
            ) : null}

            {transactionConfirmation?.healthFactor ? (
              <HealthFactorInfo
                data={transactionConfirmation.healthFactor}
                liquidationAt={transactionConfirmation.liquidationAt}
              />
            ) : null}

            {transactionConfirmation?.myBorrow ? (
              <PositionInfo
                type="borrow"
                data={transactionConfirmation.myBorrow}
              />
            ) : null}

            {transactionConfirmation?.remainingCollateral ? (
              <>
                <Divider />
                <RemainingCollateralInfo
                  data={transactionConfirmation.remainingCollateral}
                />
              </>
            ) : null}

            <BorrowInfoItem
              title={intl.formatMessage({
                id: ETranslations.slippage_tolerance_title,
              })}
            >
              <XStack
                alignItems="center"
                gap="$1"
                userSelect="none"
                onPress={handleOpenSlippage}
              >
                <SizableText size="$bodyMdMedium">
                  {displaySlippageText}
                </SizableText>
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </XStack>
            </BorrowInfoItem>
          </YStack>
        </YStack>
      </StakingFormWrapper>

      {beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={intl.formatMessage({ id: ETranslations.defi_repay })}
            confirmButtonProps={{
              onPress: handleSubmit,
              loading: submitting || checkAmountLoading,
              disabled: isButtonDisabled,
            }}
          />
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      ) : (
        <Page.FooterActions
          onConfirmText={intl.formatMessage({ id: ETranslations.defi_repay })}
          confirmButtonProps={{
            onPress: handleSubmit,
            loading: submitting || checkAmountLoading,
            disabled: isButtonDisabled,
          }}
        />
      )}
    </>
  );
}

export function BorrowRepayPosition({
  onWalletConfirm,
  onRepayWithCollateralConfirm,
  collateralAssets,
  collateralLoading,
  defaultCollateralReserveAddress,
  debtBalance,
  ...props
}: IBorrowRepayPositionProps) {
  const intl = useIntl();
  const [mode, setMode] = useState<IRepayMode>('wallet');
  const modeOptions = [
    {
      label: intl.formatMessage({
        id: ETranslations.defi_from_wallet_balance,
      }),
      value: 'wallet' as const,
    },
    {
      label: intl.formatMessage({
        id: ETranslations.defi_with_collateral,
      }),
      value: 'collateral' as const,
    },
  ];

  // Hide the entry for this release while keeping the collateral repay flow
  // implemented behind the flag.
  const isCollateralRepayEnabled =
    ENABLE_COLLATERAL_REPAY_ENTRY &&
    !!debtBalance &&
    (!!collateralLoading || collateralAssets.length > 0);

  if (!isCollateralRepayEnabled) {
    return (
      <ManagePosition {...props} action="repay" onConfirm={onWalletConfirm} />
    );
  }

  return (
    <YStack>
      <XStack px="$5" pt="$4" pb="$4">
        <SegmentControl
          fullWidth
          h={32}
          p="$0.5"
          gap="$0.5"
          borderRadius="$2.5"
          borderCurve="continuous"
          value={mode}
          options={modeOptions}
          onChange={(value) => {
            setMode(value as IRepayMode);
          }}
          slotBackgroundColor="$bgStrong"
          activeBackgroundColor="$whiteA12"
          activeTextColor="$textOnBrightColor"
          inactiveTextColor="$textSubdued"
          segmentControlItemStyleProps={{
            h: 28,
            py: '$1',
            px: '$2',
            borderRadius: '$2',
            borderCurve: 'continuous',
          }}
        />
      </XStack>

      {mode === 'wallet' ? (
        <ManagePosition {...props} action="repay" onConfirm={onWalletConfirm} />
      ) : (
        <RepayWithCollateralForm
          {...props}
          onRepayWithCollateralConfirm={onRepayWithCollateralConfirm}
          collateralAssets={collateralAssets}
          collateralLoading={collateralLoading}
          defaultCollateralReserveAddress={defaultCollateralReserveAddress}
          debtBalance={debtBalance}
        />
      )}
    </YStack>
  );
}
