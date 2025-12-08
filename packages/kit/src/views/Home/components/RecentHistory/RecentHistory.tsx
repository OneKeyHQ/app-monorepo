import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
        <Button
          size="small"
          variant="tertiary"
          iconAfter="ChevronRightSmallOutline"
          color="$textSubdued"
          iconProps={{ color: '$iconSubdued' }}
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
