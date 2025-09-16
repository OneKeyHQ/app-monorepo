import { memo, useCallback, useState } from 'react';

import {
  Badge,
  Dialog,
  Input,
  SizableText,
  Slider,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveAssetDataAtom,
  useCurrentTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSelectedAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenList } from '../../../hooks/usePerpMarketData';

interface ILeverageContentProps {
  initialValue: number;
  maxLeverage: number;
  tokenInfo: { assetId: number; name: string };
  activeAssetData: { leverage?: { type: string } };
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
      try {
        await backgroundApiProxy.serviceHyperliquidExchange.updateLeverage({
          asset: tokenInfo.assetId,
          isCross: activeAssetData?.leverage?.type === 'cross',
          leverage: value,
        });
        void dialogInstance.close();
      } catch (error) {
        console.error(
          '[LeverageAdjustModal] Failed to update leverage:',
          error,
        );
      } finally {
        setLoading(false);
      }
    }, [
      value,
      tokenInfo.assetId,
      activeAssetData?.leverage?.type,
      dialogInstance,
    ]);

    const isDisabled = value <= 0 || loading;

    return (
      <YStack>
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd" color="$color11">
            Leverage
          </SizableText>
          <Input
            size="small"
            value={value ? value.toString() : ''}
            onChangeText={handleInputChange}
            keyboardType="numeric"
            width={60}
            textAlign="center"
            disabled={loading}
            addOns={[{ label: 'x' }]}
          />
        </XStack>

        <YStack p="$1" my="$3">
          <Slider
            value={value || 1}
            onChange={handleSliderChange}
            min={1}
            max={maxLeverage}
            step={1}
            disabled={loading}
          />
        </YStack>
        <SizableText size="$bodySm" color="$textSubdued">
          The maximum leverage is {maxLeverage}x. Max position size decreases
          the higher your leverage.
        </SizableText>

        <Dialog.Footer
          onConfirm={handleConfirm}
          onConfirmText="Confirm"
          confirmButtonProps={{
            disabled: isDisabled,
            loading,
          }}
          showCancelButton={false}
        />
      </YStack>
    );
  },
);
LeverageContent.displayName = 'LeverageContent';

export const LeverageAdjustModal = memo(() => {
  const [selectedAccount] = usePerpsSelectedAccountAtom();
  const userAddress = selectedAccount.accountAddress;

  const [currentToken] = useCurrentTokenAtom();
  const { getTokenInfo } = useTokenList();
  const [activeAssetData] = useActiveAssetDataAtom();

  const tokenInfo = getTokenInfo(currentToken);

  const showLeverageDialog = useCallback(() => {
    if (!userAddress || !tokenInfo || !activeAssetData) return;

    const initialValue =
      activeAssetData?.leverage?.value || tokenInfo.maxLeverage || 1;
    const maxLeverage = tokenInfo.maxLeverage || 25;

    Dialog.show({
      title: 'Adjust Leverage',
      description: `Control the leverage used for ${tokenInfo.name} positions.`,
      renderContent: (
        <LeverageContent
          initialValue={initialValue}
          maxLeverage={maxLeverage}
          tokenInfo={tokenInfo}
          activeAssetData={activeAssetData}
        />
      ),
      showFooter: false,
    });
  }, [tokenInfo, userAddress, activeAssetData]);

  if (!userAddress || !tokenInfo) {
    return null;
  }

  return (
    <Badge
      borderRadius="$2"
      bg="$bgSubdued"
      onPress={showLeverageDialog}
      px="$3.5"
      h={30}
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
        {activeAssetData?.leverage?.value || tokenInfo.maxLeverage || 1}x
      </SizableText>
    </Badge>
  );
});

LeverageAdjustModal.displayName = 'LeverageAdjustModal';
