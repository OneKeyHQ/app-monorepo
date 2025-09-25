import { useCallback, useMemo, useState } from 'react';

import { Button, Dialog, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsSelectedAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

interface IEnableTradingContentProps {
  onClose?: () => void;
}

function EnableTradingContent({ onClose }: IEnableTradingContentProps) {
  const [loading, setLoading] = useState(false);
  const [accountStatus] = usePerpsSelectedAccountStatusAtom();

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
      return appLocale.intl.formatMessage({
        id: ETranslations.transfer_transfer_server_status_connecting,
      });
    }
    return appLocale.intl.formatMessage({
      id: ETranslations.perp_trade_button_enable_trading,
    });
  }, [loading]);

  return (
    <YStack gap="$4" p="$1">
      <YStack gap="$3">
        <SizableText size="$bodyMd" color="$textSubdued">
          {appLocale.intl.formatMessage({
            id: ETranslations.perp_enable_trading_desc,
          })}
        </SizableText>
      </YStack>

      <Button
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
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}
