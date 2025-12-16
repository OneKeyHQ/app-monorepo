import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
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
      title={intl.formatMessage({
        id: ETranslations.wallet_recent_transaction_history_title,
      })}
      titleProps={{
        color: '$text',
      }}
      headerActions={
        <Button
          size="small"
          variant="tertiary"
          iconAfter="ChevronRightSmallOutline"
          color="$textSubdued"
          iconProps={{ color: '$iconSubdued' }}
          onPress={() => {
            appEventBus.emit(EAppEventBusNames.SwitchWalletHomeTab, {
              id: EHomeWalletTab.History,
            });
          }}
        >
          {intl.formatMessage({
            id: ETranslations.global_all,
          })}
        </Button>
      }
      content={renderContent()}
    />
  );
}

export { RecentHistory };
