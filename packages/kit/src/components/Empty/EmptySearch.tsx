import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';

function EmptySearch() {
  const intl = useIntl();
  return (
    <Empty
      testID="Wallet-No-Search-Empty"
      icon="SearchOutline"
      title={intl.formatMessage({ id: 'content__no_results' })}
    />
  );
}

export { EmptySearch };
