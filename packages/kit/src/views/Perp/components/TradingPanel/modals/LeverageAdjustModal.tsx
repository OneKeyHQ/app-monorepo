import { memo, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import {
  Badge,
  Button,
  Icon,
  Input,
  SizableText,
  Slider,
  XStack,
  YStack,
  getFontSize,
  useDialogInstance,
  useInPageDialog,
} from '@onekeyhq/components';
import { useDelayedState } from '@onekeyhq/kit/src/hooks/useDelayedState';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';
import { InputAccessoryDoneButton } from '../inputs/TradingFormInput';

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
    const [value, setValue] = useDelayedState(initialValue);
    const [loading, setLoading] = useState(false);
    const dialogInstance = useDialogInstance();
    const actions = useHyperliquidActions();

    const handleSliderChange = useCallback(
      (newValue: number) => {
        const roundedValue = Math.round(newValue);
        setValue(roundedValue);
      },
      [setValue],
    );

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
      [maxLeverage, setValue],
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
    const nativeInputProps = platformEnv.isNativeIOS
      ? { inputAccessoryViewID: 'leverage-adjust-input-accessory-view' }
      : {};
    return (
      <>
        <YStack gap="$5" flex={1}>
          <YStack p="$1" gap="$4" flex={1}>
            <XStack justifyContent="center" alignItems="center">
              <Input
                containerProps={{
                  borderRadius: '$3',
                  borderWidth: 0,
                  p: 0,
                  w: 80,
                  justifyContent: 'flex-end',
                  alignItems: 'flex-end',
                }}
                InputComponentStyle={{
                  p: 0,
                }}
                fontSize={
                  platformEnv.isNativeAndroid ? 34 : getFontSize('$heading5xl')
                }
                alignItems="center"
                justifyContent="center"
                value={value ? value.toString() : ''}
                onChangeText={handleInputChange}
                keyboardType="numeric"
                textAlign="center"
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
                {...nativeInputProps}
              />
            </XStack>
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
            </XStack>
          </YStack>
          <YStack gap="$2" pb="$4">
            <XStack gap="$1" alignItems="center" justifyContent="flex-start">
              <Icon
                name="InfoCircleSolid"
                size="$3.5"
                color="$iconSubdued"
                flexShrink={0}
              />
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.perp_leverage_desc_warning,
                  },
                  {
                    token: parseDexCoin(tokenInfo.coin).displayName,
                    leverage: `${maxLeverage}x`,
                  },
                )}
              </SizableText>
            </XStack>
            <XStack gap="$1" alignItems="center" justifyContent="flex-start">
              <Icon
                name="InfoCircleSolid"
                size="$3.5"
                color="$iconSubdued"
                flexShrink={0}
              />
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_leverage_warning_2,
                })}
              </SizableText>
            </XStack>
          </YStack>
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
        {platformEnv.isNativeIOS ? (
          <InputAccessoryView nativeID="leverage-adjust-input-accessory-view">
            <InputAccessoryDoneButton />
          </InputAccessoryView>
        ) : null}
      </>
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
    const dialog = useInPageDialog();
    const showLeverageDialog = useCallback(() => {
      if (!userAddress || !currentToken || !activeAssetData) return;

      const initialValue =
        activeAssetData?.leverage?.value ||
        currentToken?.universe?.maxLeverage ||
        1;
      const maxLeverage = currentToken?.universe?.maxLeverage || 25;

      dialog.show({
        title: intl.formatMessage({
          id: ETranslations.perp_trading_adjust_leverage,
        }),
        disableDrag: true,
        dismissOnOverlayPress: false,
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
    }, [userAddress, currentToken, activeAssetData, dialog, intl]);

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
        gap="$1"
      >
        {isMobile ? null : (
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({
              id: ETranslations.perp_leverage,
            })}
          </SizableText>
        )}
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
