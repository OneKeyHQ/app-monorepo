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

import {
  Icon,
  Image,
  Input,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
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
  }: ITokenInputSectionProps,
  ref: Ref<ITokenInputSectionRef>,
) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef<IInputRef>(null);

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
      }
    },
    [onChange, selectedToken?.decimals],
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

  const placeholderText =
    tradeType === ESwapDirection.BUY
      ? intl.formatMessage({ id: ETranslations.dexmarket_total })
      : intl.formatMessage({
          id: ETranslations.dexmarket_details_history_amount,
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

  return (
    <YStack gap="$1">
      <Input
        ref={inputRef}
        size={gtMd ? 'medium' : 'large'}
        keyboardType="decimal-pad"
        value={internalValue}
        placeholder={intl.formatMessage({
          id: ETranslations.dexmarket_enter_amount,
        })}
        onChangeText={handleInternalChange}
        leftAddOnProps={{
          label: placeholderText,
        }}
        addOns={[
          {
            renderContent: (
              <XStack
                alignItems="center"
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
                {selectedToken?.logoURI ? (
                  <Image
                    src={selectedToken.logoURI}
                    width="$5"
                    height="$5"
                    borderRadius="$full"
                  />
                ) : null}
                <SizableText size="$bodyLg">
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
        onSelect={handleInternalChange}
        tradeType={tradeType}
        balance={balance}
        swapNativeTokenReserveGas={swapNativeTokenReserveGas}
      />
    </YStack>
  );
}

export const TokenInputSection = forwardRef<
  ITokenInputSectionRef,
  ITokenInputSectionProps
>(TokenInputSectionComponent);
