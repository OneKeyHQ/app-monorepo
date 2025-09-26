import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Dialog,
  Icon,
  Input,
  SizableText,
  Slider,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';

interface ILeverageContentProps {
  initialValue: number;
  maxLeverage: number;
  tokenInfo: IPerpsActiveAssetAtom;
  activeAssetData: { leverage?: { type: string } };
  isMobile?: boolean;
}

const LeverageContent = memo(
  ({
    initialValue,
    maxLeverage,
    tokenInfo,
    activeAssetData,
  }: ILeverageContentProps) => {
    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(false);
    const dialogInstance = useDialogInstance();
    const actions = useHyperliquidActions();

    const handleSliderChange = useCallback((newValue: number) => {
      const roundedValue = Math.round(newValue);
      setValue(roundedValue);
    }, []);

    const handleInputChange = useCallback(
      (text: string) => {
        let newValue = 0;
        if (text !== '') {
          const numValue = parseInt(text, 10);
          if (
            !Number.isNaN(numValue) &&
            numValue >= 1 &&
            numValue <= maxLeverage
          ) {
            newValue = numValue;
          } else {
            return;
          }
        }
        setValue(newValue);
      },
      [maxLeverage],
    );

    const handleConfirm = useCallback(async () => {
      setLoading(true);
      void dialogInstance.close();
      try {
        await actions.current.updateLeverage({
          asset: tokenInfo.assetId ?? -1,
          isCross: activeAssetData?.leverage?.type === 'cross',
          leverage: value,
        });
      } catch (error) {
        console.error(
          '[LeverageAdjustModal] Failed to update leverage:',
          error,
        );
      } finally {
        setLoading(false);
      }
    }, [
      actions,
      value,
      tokenInfo.assetId,
      activeAssetData?.leverage?.type,
      dialogInstance,
    ]);
    const isDisabled = value <= 0 || loading;
    const intl = useIntl();
    const { gtSm } = useMedia();
    return (
      <YStack gap="$3" flex={1}>
        <YStack p="$1" mb="$6" gap="$3" flex={1}>
          <XStack flex={1} alignItems="center" gap="$4">
            <Slider
              value={value || 1}
              onChange={handleSliderChange}
              min={1}
              max={maxLeverage}
              step={1}
              disabled={loading}
              flex={1}
            />
            <XStack width={gtSm ? undefined : 60} alignItems="center">
              <Input
                containerProps={{
                  borderRadius: '$3',
                  p: 0,
                }}
                InputComponentStyle={{
                  p: 0,
                }}
                width={30}
                size="medium"
                alignItems="center"
                value={value ? value.toString() : ''}
                onChangeText={handleInputChange}
                keyboardType="numeric"
                textAlign="right"
                disabled={loading}
                addOns={[
                  {
                    renderContent: (
                      <XStack alignItems="center" pr="$1">
                        <Icon name="CrossedSmallOutline" size="$5" />
                      </XStack>
                    ),
                  },
                ]}
              />
            </XStack>
          </XStack>
        </YStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            {
              id: ETranslations.perp_leverage_desc_warning,
            },
            {
              token: tokenInfo.coin,
              leverage: maxLeverage,
            },
          )}
        </SizableText>

        <TradingGuardWrapper>
          <Button
            onPress={handleConfirm}
            disabled={isDisabled}
            loading={loading}
            size="medium"
            variant="primary"
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </TradingGuardWrapper>
      </YStack>
    );
  },
);
LeverageContent.displayName = 'LeverageContent';

export const LeverageAdjustModal = memo(
  ({ isMobile = false }: { isMobile?: boolean }) => {
    const [selectedAccount] = usePerpsActiveAccountAtom();
    const userAddress = selectedAccount.accountAddress;

    const [currentToken] = usePerpsActiveAssetAtom();
    const [activeAssetData] = usePerpsActiveAssetDataAtom();

    const intl = useIntl();
    const showLeverageDialog = useCallback(() => {
      if (!userAddress || !currentToken || !activeAssetData) return;

      const initialValue =
        activeAssetData?.leverage?.value ||
        currentToken?.universe?.maxLeverage ||
        1;
      const maxLeverage = currentToken?.universe?.maxLeverage || 25;

      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.perp_trading_adjust_leverage,
        }),

        renderContent: (
          <PerpsProviderMirror>
            <LeverageContent
              initialValue={initialValue}
              maxLeverage={maxLeverage}
              // tokenInfo={tokenInfo}
              tokenInfo={currentToken}
              activeAssetData={activeAssetData}
            />
          </PerpsProviderMirror>
        ),
        showFooter: false,
      });
    }, [userAddress, currentToken, activeAssetData, intl]);

    if (!userAddress || !currentToken) return null;

    return (
      <Badge
        borderRadius="$2"
        bg="$bgSubdued"
        onPress={showLeverageDialog}
        px="$3.5"
        h={isMobile ? 32 : 30}
        alignItems="center"
        hoverStyle={{
          bg: '$bgStrongHover',
        }}
        pressStyle={{
          bg: '$bgStrongActive',
        }}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium">
          {activeAssetData?.leverage?.value ||
            currentToken?.universe?.maxLeverage ||
            1}
          x
        </SizableText>
      </Badge>
    );
  },
);

LeverageAdjustModal.displayName = 'LeverageAdjustModal';
