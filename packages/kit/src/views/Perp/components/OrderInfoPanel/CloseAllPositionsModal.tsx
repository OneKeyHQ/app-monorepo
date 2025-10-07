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
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { TradingGuardWrapper } from '../TradingGuardWrapper';

type ICloseType = 'market' | 'limit';

interface ICloseAllPositionsContentProps {
  onClose?: () => void;
}

function CloseAllPositionsContent({ onClose }: ICloseAllPositionsContentProps) {
  const actions = useHyperliquidActions();
  const intl = useIntl();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeType, setCloseType] = useState<ICloseType>('market');

  const handleConfirm = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await actions.current.closeAllPositions(closeType);
      onClose?.();
    } catch (error) {
      console.error('Close all positions failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [actions, closeType, isSubmitting, onClose]);

  const buttonText = useMemo(() => {
    if (isSubmitting) {
      return intl.formatMessage({
        id: ETranslations.perp_toast_closing_position,
      });
    }

    return intl.formatMessage({
      id: ETranslations.perp_confirm_order,
    });
  }, [isSubmitting, intl]);

  return (
    <YStack gap="$4" p="$1">
      {/* Description */}
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_close_all_msg,
        })}
      </SizableText>

      {/* Close Type Options */}
      <YStack>
        {/* Market Close */}
        <XStack>
          <Checkbox
            labelProps={{
              fontSize: '$bodyMd',
            }}
            label={intl.formatMessage({
              id: ETranslations.perp_close_all_market,
            })}
            value={closeType === 'market'}
            onChange={(checked) => {
              if (checked) {
                setCloseType('market');
              }
            }}
          />
        </XStack>

        {/* Limit Close at Mid Price */}
        <XStack>
          <Checkbox
            labelProps={{
              fontSize: '$bodyMd',
            }}
            label={intl.formatMessage({
              id: ETranslations.perp_close_all_limit,
            })}
            value={closeType === 'limit'}
            onChange={(checked) => {
              if (checked) {
                setCloseType('limit');
              }
            }}
          />
        </XStack>
      </YStack>

      <TradingGuardWrapper>
        <Button
          variant="primary"
          size="medium"
          disabled={isSubmitting}
          loading={isSubmitting}
          onPress={handleConfirm}
        >
          {buttonText}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showCloseAllPositionsDialog() {
  const dialogInstance = Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_position_close,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <CloseAllPositionsContent
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
