import { memo, useCallback, useState } from 'react';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Slider,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useActiveAssetDataAtom,
  useCurrentTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useTokenList } from '../../hooks/usePerpMarketData';

interface ILeverageContentProps {
  initialValue: number;
  maxLeverage: number;
  onValueChange: (value: number) => void;
}

const LeverageContent = memo(
  ({ initialValue, maxLeverage, onValueChange }: ILeverageContentProps) => {
    const [value, setValue] = useState(initialValue);

    const handleSliderChange = useCallback(
      (newValue: number) => {
        const roundedValue = Math.round(newValue);
        setValue(roundedValue);
        onValueChange(roundedValue);
      },
      [onValueChange],
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
        onValueChange(newValue);
      },
      [maxLeverage, onValueChange],
    );

    return (
      <YStack space="$4">
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
            addOns={[{ label: 'x' }]}
          />
        </XStack>

        <Slider
          value={value || 1}
          onChange={handleSliderChange}
          min={1}
          max={maxLeverage}
          step={1}
        />

        <SizableText size="$bodySm" color="$textSubdued">
          The maximum leverage is {maxLeverage}x. Max position size decreases
          the higher your leverage.
        </SizableText>
      </YStack>
    );
  },
);
LeverageContent.displayName = 'LeverageContent';

export const LeverageAdjustModal = memo(() => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const userAccountId = activeAccount?.dbAccount?.id;

  const [currentToken] = useCurrentTokenAtom();
  const { getTokenInfo } = useTokenList();
  const [activeAssetData] = useActiveAssetDataAtom();

  const tokenInfo = getTokenInfo(currentToken);

  const showLeverageDialog = useCallback(() => {
    if (!userAccountId || !tokenInfo || !activeAssetData) return;

    const initialValue =
      activeAssetData?.leverage?.value || tokenInfo.maxLeverage || 1;
    const maxLeverage = tokenInfo.maxLeverage || 25;
    let currentValue = initialValue;

    const handleValueChange = (value: number) => {
      currentValue = value;
    };

    Dialog.confirm({
      title: 'Adjust Leverage',
      description: `Control the leverage used for ${tokenInfo.name} positions.`,
      renderContent: (
        <LeverageContent
          initialValue={initialValue}
          maxLeverage={maxLeverage}
          onValueChange={handleValueChange}
        />
      ),
      onConfirm: async () => {
        await backgroundApiProxy.serviceHyperliquidExchange.updateLeverage({
          asset: tokenInfo.assetId,
          isCross: activeAssetData?.leverage?.type === 'cross',
          leverage: currentValue,
        });
      },
    });
  }, [tokenInfo, userAccountId, activeAssetData]);

  if (!userAccountId || !tokenInfo) {
    return null;
  }

  return (
    <Button
      size="small"
      variant="tertiary"
      borderRadius="$2"
      bg="$bgSubdued"
      onPress={showLeverageDialog}
      px="$3"
      py="$1"
      mr="$1"
    >
      <SizableText size="$bodyMd" fontWeight="500">
        {activeAssetData?.leverage?.value || tokenInfo.maxLeverage || 1}x
      </SizableText>
    </Button>
  );
});

LeverageAdjustModal.displayName = 'LeverageAdjustModal';
