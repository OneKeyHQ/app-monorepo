import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  CONTEXTUAL_ARTICLE_IDS,
  buildHelpUrl,
  openGuideUrl,
} from '../../Guide/perpGuideData';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

interface IEnableTradingContentProps {
  onClose?: () => void;
}

function EnableTradingContent({ onClose }: IEnableTradingContentProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [accountStatus] = usePerpsActiveAccountStatusAtom();

  const isAgentNotReady = useMemo(
    () => !accountStatus?.details?.agentOk || !accountStatus?.canTrade,
    [accountStatus?.details?.agentOk, accountStatus?.canTrade],
  );

  const handleEnableTrading = useCallback(async () => {
    if (!isAgentNotReady) return;

    setLoading(true);
    try {
      const result =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      if (result?.details?.agentOk && result?.canTrade) {
        onClose?.();
      }
    } catch (error) {
      console.error('[EnableTradingModal] Failed to enable trading:', error);
    } finally {
      setLoading(false);
    }
  }, [isAgentNotReady, onClose]);

  const buttonText = useMemo(() => {
    if (loading) {
      return intl.formatMessage({
        id: ETranslations.transfer_transfer_server_status_connecting,
      });
    }
    return intl.formatMessage({
      id: ETranslations.perp_trade_button_enable_trading,
    });
  }, [loading, intl]);

  return (
    <YStack gap="$4" p="$1">
      <YStack gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perp_enable_trading_desc,
          })}
        </SizableText>
        <XStack
          gap="$1"
          alignItems="center"
          onPress={() => {
            onClose?.();
            setTimeout(() => {
              openGuideUrl(
                buildHelpUrl(
                  `articles/${CONTEXTUAL_ARTICLE_IDS.enableTrading}`,
                ),
              );
            }, 150);
          }}
          cursor="default"
        >
          <Icon name="QuestionmarkOutline" size="$3.5" color="$iconSubdued" />
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            hoverStyle={{ color: '$text' }}
          >
            {intl.formatMessage({
              id: ETranslations.perp_guide_article_introduction,
            })}
          </SizableText>
        </XStack>
      </YStack>

      <Button
        testID="perp-btn"
        variant="primary"
        size="medium"
        disabled={loading || !isAgentNotReady}
        loading={loading}
        onPress={handleEnableTrading}
        bg="#18794E"
        hoverStyle={{ bg: '$green8' }}
        pressStyle={{ bg: '$green8' }}
        color="$textOnColor"
      >
        {buttonText}
      </Button>
    </YStack>
  );
}

export function showEnableTradingDialog() {
  const dialogInstance = Dialog.show({
    // Called from jotai action without React context; safe at invocation time
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.perp_trade_button_enable_trading,
    }),
    renderContent: (
      <EnableTradingContent
        onClose={() => {
          void dialogInstance.close();
        }}
      />
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
