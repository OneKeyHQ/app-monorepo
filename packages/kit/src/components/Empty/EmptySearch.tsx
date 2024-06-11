import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptySearch() {
  const intl = useIntl();
  return (
    <Empty
      testID="Wallet-No-Search-Empty"
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_search_no_results_title,
      })}
    />
  );
}

export { EmptySearch };
