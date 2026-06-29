import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { useInPageDialog } from '@onekeyhq/components';
import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';

import type { IntlShape } from 'react-intl';

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
        borderWidth="$px"
        borderColor={
          selectedMode === 'cross' ? '$borderActive' : '$borderSubdued'
        }
        onPress={() => setSelectedMode('cross')}
        cursor="default"
        hoverStyle={{
          borderColor:
            selectedMode === 'cross' ? '$borderActive' : '$borderStrong',
        }}
        pressStyle={{ borderColor: '$borderActive' }}
      >
        <YStack gap="$1">
          <SizableText size="$headingMd" fontWeight="600">
            {intl.formatMessage({ id: ETranslations.perp_trade_cross })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_cross_mode_desc,
            })}
          </SizableText>
        </YStack>
      </YStack>

      {/* Isolated Mode Option */}
      <YStack
        p="$4"
        borderRadius="$3"
        borderWidth="$px"
        borderColor={
          selectedMode === 'isolated' ? '$borderActive' : '$borderSubdued'
        }
        onPress={() => setSelectedMode('isolated')}
        cursor="default"
        hoverStyle={{
          borderColor:
            selectedMode === 'isolated' ? '$borderActive' : '$borderStrong',
        }}
        pressStyle={{ borderColor: '$borderActive' }}
      >
        <YStack gap="$1">
          <SizableText size="$headingMd" fontWeight="600">
            {intl.formatMessage({ id: ETranslations.perp_trade_isolated })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_isolate_mode_desc,
            })}
          </SizableText>
        </YStack>
      </YStack>

      <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
        <Button
          testID="perp-btn"
          variant="primary"
          size={PERP_DIALOG_BUTTON_SIZE}
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
  intl: IntlShape,
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  const title = `${parseDexCoin(symbolCoin).displayName} ${intl.formatMessage({
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
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
