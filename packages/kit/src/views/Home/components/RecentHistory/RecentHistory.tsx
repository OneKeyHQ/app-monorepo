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
    return <TxHistoryListContainer plainMode tableLayout={false} limit={5} />;
  }, []);
  return (
    <RichBlock
      title={intl.formatMessage({
        id: ETranslations.network_recent_used_network,
      })}
      titleProps={{
        color: '$textSubdued',
      }}
      headerActions={
        <XStack py="$1">
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
        </XStack>
      }
      content={renderContent()}
    />
  );
}

export { RecentHistory };
