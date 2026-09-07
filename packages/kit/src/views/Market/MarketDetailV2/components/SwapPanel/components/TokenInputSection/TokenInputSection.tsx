import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Ref } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Input, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IInputRef, IYStackProps } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import SwapInputActions from '@onekeyhq/kit/src/views/Swap/pages/components/SwapInputActions';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapNativeTokenReserveGas } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection, type ITradeType } from '../../hooks/useTradeType';

import { QuickAmountSelector } from './QuickAmountSelector';
import { TokenSelectorPopover } from './TokenSelectorPopover';

import type { IToken } from '../../types';
import type { IAmountEnterSource } from '../../types/analytics';
import type BigNumber from 'bignumber.js';

export interface ITokenInputSectionRef {
  setValue: (value: string) => void;
}

export interface ITokenInputSectionProps {
  onChange: (value: string) => void;
  selectedToken?: IToken;
  selectableTokens: IToken[];
  onTokenChange: (token: IToken) => void;
  onPressTokenSelector?: () => void;
  tradeType: ITradeType;
  balance?: BigNumber;
  swapNativeTokenReserveGas: ISwapNativeTokenReserveGas[];
  onAmountEnterTypeChange?: (source: IAmountEnterSource) => void;
  style?: IYStackProps;
  disableNativeToken?: boolean;
  stockDetailDesktopLayout?: boolean;
  balanceLoading?: boolean;
  fiatValue?: string;
  onMaxPress?: () => void;
  onSelectPercentageStage?: (stage: number) => void;
}

function TokenInputSectionComponent(
  {
    onChange,
    selectedToken,
    selectableTokens,
    onTokenChange,
    tradeType,
    balance,
    swapNativeTokenReserveGas,
    onAmountEnterTypeChange,
    style,
    disableNativeToken,
    stockDetailDesktopLayout,
    balanceLoading,
    fiatValue,
    onMaxPress,
    onSelectPercentageStage,
  }: ITokenInputSectionProps,
  ref: Ref<ITokenInputSectionRef>,
) {
  const intl = useIntl();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);
  const inputRef = useRef<IInputRef>(null);
  const isPresetSelectionRef = useRef(false);
  const selectedNetworkImageUri = useNetworkLogoUri({
    networkId: selectedToken?.networkId,
  });
  useImperativeHandle(
    ref,
    () => ({
      setValue: (newValue: string) => {
        setInternalValue(newValue);
        onChange(newValue);
      },
    }),
    [onChange],
  );

  const handleInternalChange = useCallback(
    (newValue: string) => {
      if (validateAmountInput(newValue, selectedToken?.decimals)) {
        setInternalValue(newValue);
        onChange(newValue);
        // Track manual input in analytics (only if not from preset selection)
        if (!isPresetSelectionRef.current) {
          onAmountEnterTypeChange?.('manual');
        }
        // Reset the preset selection flag
        isPresetSelectionRef.current = false;
      }
    },
    [onChange, selectedToken?.decimals, onAmountEnterTypeChange],
  );

  // Handler for preset amount selection with analytics tracking
  const handlePresetAmountSelect = useCallback(
    (value: string) => {
      isPresetSelectionRef.current = true;
      handleInternalChange(value);
    },
    [handleInternalChange],
  );

  const handleTokenSelect = useCallback(
    (token: IToken) => {
      onTokenChange(token);
      setIsPopoverOpen(false);
    },
    [onTokenChange],
  );

  const isTokenSelectorVisible =
    tradeType === ESwapDirection.BUY && selectableTokens.length > 1;

  const placeholderLabel =
    tradeType === ESwapDirection.BUY
      ? intl.formatMessage({ id: ETranslations.dexmarket_total })
      : intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
        });

  const placeholderText = (
    <SizableText size="$bodyMdMedium" color="$textSubdued" userSelect="none">
      {placeholderLabel}
    </SizableText>
  );

  const handleAmountInputFocus = useCallback(() => {
    setPercentageInputStageShow(true);
  }, []);
  const handleAmountInputBlur = useCallback(() => {
    setTimeout(() => {
      setPercentageInputStageShow(false);
    }, 200);
  }, []);
  const showPercentageInput = Boolean(
    selectedToken &&
    onSelectPercentageStage &&
    !balanceLoading &&
    balance !== undefined &&
    (percentageInputStageShow || internalValue),
  );
  const showPercentageInputDebounce = useDebounce(showPercentageInput, 100, {
    leading: true,
  });

  useEffect(() => {
    const handleSwapSpeedBuildTxSuccess = (data: {
      fromToken: import('@onekeyhq/shared/types/swap/types').ISwapTokenBase;
      toToken: import('@onekeyhq/shared/types/swap/types').ISwapTokenBase;
      fromAmount: string;
      toAmount: string;
    }) => {
      if (
        selectedToken &&
        equalTokenNoCaseSensitive({
          token1: selectedToken,
          token2: data.fromToken,
        })
      ) {
        setInternalValue('');
        onChange('');
      }
    };

    appEventBus.on(
      EAppEventBusNames.SwapSpeedBuildTxSuccess,
      handleSwapSpeedBuildTxSuccess,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBuildTxSuccess,
        handleSwapSpeedBuildTxSuccess,
      );
    };
  }, [selectedToken, onChange]);

  // Listen for keyboard dismiss events
  useEffect(() => {
    const handleDismissKeyboard = () => {
      inputRef.current?.blur();
      dismissKeyboard();
    };

    appEventBus.on(
      EAppEventBusNames.SwapPanelDismissKeyboard,
      handleDismissKeyboard,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapPanelDismissKeyboard,
        handleDismissKeyboard,
      );
      dismissKeyboard();
    };
  }, []);

  if (stockDetailDesktopLayout) {
    return (
      <YStack {...style}>
        <YStack
          testID="stock-trade-pay-card"
          height={114}
          bg="$bgSubdued"
          borderRadius="$3"
          overflow="hidden"
        >
          <XStack
            height={30}
            pt="$2.5"
            px="$3.5"
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id:
                  tradeType === ESwapDirection.BUY
                    ? ETranslations.global_pay
                    : ETranslations.global_sell,
              })}
            </SizableText>
            <SwapInputActions
              fromToken={selectedToken}
              showPercentageInput={showPercentageInputDebounce}
              showActionBuy={false}
              onSelectStage={onSelectPercentageStage}
            />
          </XStack>
          <AmountInput
            value={internalValue}
            onChange={handleInternalChange}
            bg="$transparent"
            borderWidth={0}
            borderRadius="$0"
            flex={1}
            valueProps={{
              value: fiatValue,
              currency: '$',
            }}
            balanceProps={{
              value: balance?.toFixed(),
              loading: balanceLoading,
              onPress: onMaxPress,
              hideIcon: true,
              testID: onMaxPress ? 'stock-trade-max-button' : undefined,
            }}
            maxAmountText={intl.formatMessage({
              id: ETranslations.global_max,
            })}
            inputProps={{
              placeholder: '0.0',
              onFocus: handleAmountInputFocus,
              onBlur: handleAmountInputBlur,
              testID: 'market-handle-dismiss-keyboard-input',
            }}
            tokenSelectorTriggerProps={{
              testID: 'stock-trade-payment-token-selector',
              minWidth: 132,
              justifyContent: 'flex-end',
              selectedTokenImageUri: selectedToken?.logoURI,
              selectedNetworkImageUri,
              selectedTokenSymbol: selectedToken?.symbol,
              showNetworkIconBorder: false,
              disabled: !isTokenSelectorVisible,
              onPress: isTokenSelectorVisible
                ? () => setIsPopoverOpen(true)
                : undefined,
            }}
            enableMaxAmount={Boolean(onMaxPress && balance)}
          />
        </YStack>
        <TokenSelectorPopover
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          tokens={selectableTokens}
          onTokenPress={handleTokenSelect}
          currentSelectToken={selectedToken}
          disableNativeToken={disableNativeToken}
          disabledOnSwitchToTrade
        />
      </YStack>
    );
  }

  return (
    <YStack {...style}>
      <YStack borderRadius="$2" bg="$bgApp" gap="$px" overflow="hidden">
        <Input
          testID="market-handle-dismiss-keyboard-input"
          ref={inputRef}
          size="small"
          containerProps={{
            flex: 1,
            borderWidth: 0,
            h: 44,
            alignItems: 'center',
            borderRadius: 0,
            bg: '$bgStrong',
          }}
          keyboardType="decimal-pad"
          value={internalValue}
          placeholder={intl.formatMessage({
            id: ETranslations.dexmarket_enter_amount,
          })}
          onChangeText={handleInternalChange}
          leftAddOnProps={{
            label: placeholderText,
          }}
          addOnsContainerProps={{
            borderRadius: 0,
          }}
          addOns={[
            {
              renderContent: (
                <XStack
                  alignItems="center"
                  h={44}
                  gap="$1"
                  px="$2"
                  {...(isTokenSelectorVisible && {
                    onPress: () => setIsPopoverOpen(true),
                    userSelect: 'none',
                    hoverStyle: { bg: '$bgHover' },
                    pressStyle: { bg: '$bgActive' },
                    borderCurve: 'continuous',
                  })}
                >
                  <SizableText size="$bodyMd" numberOfLines={1} maxWidth="$16">
                    {selectedToken?.symbol}
                  </SizableText>
                  {isTokenSelectorVisible ? (
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  ) : null}
                </XStack>
              ),
            },
          ]}
        />
        <TokenSelectorPopover
          isOpen={isPopoverOpen}
          onOpenChange={setIsPopoverOpen}
          tokens={selectableTokens}
          onTokenPress={handleTokenSelect}
          disableNativeToken={disableNativeToken}
        />
        <QuickAmountSelector
          buyAmounts={
            selectedToken?.speedSwapDefaultAmount?.map((amount) => ({
              label: amount.toString(),
              value: amount,
            })) ?? []
          }
          selectedTokenDecimals={selectedToken?.decimals}
          selectedTokenNetworkId={selectedToken?.networkId}
          selectedTokenIsNative={selectedToken?.isNative}
          onSelect={handlePresetAmountSelect}
          onPresetSelect={onAmountEnterTypeChange}
          tradeType={tradeType}
          balance={balance}
          swapNativeTokenReserveGas={swapNativeTokenReserveGas}
        />
      </YStack>
    </YStack>
  );
}

export const TokenInputSection = forwardRef<
  ITokenInputSectionRef,
  ITokenInputSectionProps
>(TokenInputSectionComponent);
