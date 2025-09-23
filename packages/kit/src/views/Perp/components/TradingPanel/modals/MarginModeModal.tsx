import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useActiveAssetDataAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useCurrentTokenData } from '../../../hooks';
import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';

type IMarginMode = 'isolated' | 'cross';

interface IMarginModeContentProps {
  onClose?: () => void;
}

function MarginModeContent({ onClose }: IMarginModeContentProps) {
  const intl = useIntl();
  const [activeAssetData] = useActiveAssetDataAtom();
  const tokenInfo = useCurrentTokenData();
  const actions = useHyperliquidActions();

  const [selectedMode, setSelectedMode] = useState<IMarginMode>(
    activeAssetData?.leverage?.type || 'isolated',
  );
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (tokenInfo?.assetId === undefined) return;

    const currentLeverage = activeAssetData?.leverage?.value || 1;
    const isCross = selectedMode === 'cross';

    try {
      setLoading(true);
      await actions.current.updateLeverage({
        asset: tokenInfo.assetId,
        leverage: currentLeverage,
        isCross,
      });
      onClose?.();
    } catch (error) {
      console.error('[MarginModeModal] Failed to update margin mode:', error);
    } finally {
      setLoading(false);
    }
  }, [
    tokenInfo?.assetId,
    activeAssetData?.leverage?.value,
    selectedMode,
    actions,
    onClose,
  ]);

  const buttonText = useMemo(() => {
    if (loading) {
      return 'Confirming...';
    }
    return intl.formatMessage({ id: ETranslations.global_confirm });
  }, [loading, intl]);

  return (
    <YStack gap="$4">
      {/* Cross Mode Option */}
      <YStack
        p="$4"
        borderRadius="$3"
        bg="$bgSubdued"
        onPress={() => setSelectedMode('cross')}
        cursor="pointer"
      >
        <XStack alignItems="center" gap="$3">
          <Checkbox value={selectedMode === 'cross'} />
          <SizableText size="$headingMd" fontWeight="600">
            {intl.formatMessage({ id: ETranslations.perp_trade_cross })}
          </SizableText>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          All cross positions share the same cross margin as collateral. In the
          event of liquidation, your cross margin balance and any remaining open
          positions under assets in this mode may be forfeited.
        </SizableText>
      </YStack>

      {/* Isolated Mode Option */}
      <YStack
        p="$4"
        borderRadius="$3"
        bg="$bgSubdued"
        onPress={() => setSelectedMode('isolated')}
        cursor="pointer"
      >
        <XStack alignItems="center" gap="$3">
          <Checkbox value={selectedMode === 'isolated'} />
          <SizableText size="$headingMd" fontWeight="600">
            {intl.formatMessage({ id: ETranslations.perp_trade_isolated })}
          </SizableText>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          Manage your risk on individual positions by restricting the amount of
          margin allocated to each. If the margin ratio of an isolated position
          reaches 100%, the position will be liquidated. Margin can be added or
          removed to individual positions in this mode.
        </SizableText>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={loading}
          loading={loading}
          onPress={handleConfirm}
          bg="$green9"
          hoverStyle={{ bg: '$green8' }}
          pressStyle={{ bg: '$green8' }}
          color="$textOnColor"
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showMarginModeDialog(symbolCoin: string) {
  const title = `${symbolCoin}-USD Margin Mode`;

  const dialogInstance = Dialog.show({
    title,
    floatingPanelProps: {
      width: 400,
    },
    renderContent: (
      <PerpsProviderMirror>
        <MarginModeContent
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
