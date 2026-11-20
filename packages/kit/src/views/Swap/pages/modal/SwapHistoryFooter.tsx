import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SwapHistoryFooter({
  canTradeAgain,
  hasSupport,
  onTradeAgain,
  onSupport,
}: {
  canTradeAgain: boolean;
  hasSupport: boolean;
  onTradeAgain: () => void;
  onSupport: () => void;
}) {
  const intl = useIntl();
  if (canTradeAgain) {
    return (
      <Page.Footer
        // A declared argument prevents Page.Footer from navigating back on support.
        onCancel={hasSupport ? (_close) => onSupport() : undefined}
        onCancelText={intl.formatMessage({ id: ETranslations.global_support })}
        cancelButtonProps={
          hasSupport
            ? {
                testID: 'swap-history-support',
                variant: 'secondary',
                icon: 'BubbleAnnotationOutline',
              }
            : undefined
        }
        onConfirm={onTradeAgain}
        onConfirmText={intl.formatMessage({
          id: ETranslations.swap_button_trade_again,
        })}
        confirmButtonProps={{ testID: 'swap-history-trade-again' }}
      />
    );
  }
  if (!hasSupport) return null;
  return (
    <Page.Footer
      onConfirmText={intl.formatMessage({ id: ETranslations.global_support })}
      confirmButtonProps={{
        testID: 'swap-history-support',
        icon: 'BubbleAnnotationOutline',
        variant: 'secondary',
      }}
      onConfirm={onSupport}
    />
  );
}
