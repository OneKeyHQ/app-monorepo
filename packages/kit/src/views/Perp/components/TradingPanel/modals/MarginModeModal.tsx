import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';

type IMarginMode = 'isolated' | 'cross';

interface IMarginModeContentProps {
  onClose?: () => void;
}

function MarginModeContent({ onClose }: IMarginModeContentProps) {
  const intl = useIntl();
  const [activeAssetData] = usePerpsActiveAssetDataAtom();
  const [tokenInfo] = usePerpsActiveAssetAtom();
  const actions = useHyperliquidActions();

  const [selectedMode, setSelectedMode] = useState<IMarginMode>(
    activeAssetData?.leverage?.type || 'isolated',
  );
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (tokenInfo?.assetId === undefined) return;

    const currentLeverage = activeAssetData?.leverage?.value || 1;
    const isCross = selectedMode === 'cross';

    void onClose?.();
    try {
      setLoading(true);
      await actions.current.updateLeverage({
        asset: tokenInfo.assetId,
        leverage: currentLeverage,
        isCross,
      });
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
    return intl.formatMessage({ id: ETranslations.global_confirm });
  }, [intl]);

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
          {intl.formatMessage({
            id: ETranslations.perp_cross_mode_desc,
          })}
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
          {intl.formatMessage({
            id: ETranslations.perp_isolate_mode_desc,
          })}
        </SizableText>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={loading}
          loading={loading}
          onPress={handleConfirm}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showMarginModeDialog(
  symbolCoin: string,
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  const title = `${
    parseDexCoin(symbolCoin).displayName
  } ${appLocale.intl.formatMessage({
    id: ETranslations.perp_trade_margin_type,
  })}`;

  const DialogInstance =
    platformEnv.isNativeAndroid || !dialog ? Dialog : dialog;

  const dialogInstance = DialogInstance.show({
    title,
    floatingPanelProps: platformEnv.isNativeAndroid
      ? undefined
      : {
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
