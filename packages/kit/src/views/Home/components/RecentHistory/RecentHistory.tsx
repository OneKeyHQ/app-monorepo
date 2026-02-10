import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { TxHistoryListContainer } from '../../pages/TxHistoryContainer';
import { RichBlock } from '../RichBlock';

function RecentHistory() {
  const intl = useIntl();

  const handleNavigateToHistory = useCallback(() => {
    appEventBus.emit(EAppEventBusNames.SwitchWalletHomeTab, {
      id: EHomeWalletTab.History,
    });
  }, []);

  const renderContent = useCallback(() => {
    return (
      <TxHistoryListContainer
        plainMode
        tableLayout={false}
        limit={5}
        emptyTitle={intl.formatMessage({
          id: ETranslations.wallet_transaction_history_empty_message,
        })}
        emptyDescription={intl.formatMessage({
          id: ETranslations.wallet_transactions_empty_desc,
        })}
      />
    );
  }, [intl]);
  return (
    <RichBlock
      title={
        <XStack
          alignItems="center"
          gap="$1"
          onPress={handleNavigateToHistory}
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
        >
          <SizableText size="$headingXl" color="$text">
            {intl.formatMessage({
              id: ETranslations.wallet_recent_transaction_history_title,
            })}
          </SizableText>
          <Icon name="ChevronRightOutline" color="$iconSubdued" size="$5" />
        </XStack>
      }
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { RecentHistory };
