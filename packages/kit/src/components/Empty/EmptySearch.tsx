import { useIntl } from 'react-intl';

import { EmptyBase } from './EmptyBase';

function EmptySearch() {
  const intl = useIntl();
  return (
    <EmptyBase
      icon="SearchOutline"
      title={intl.formatMessage({ id: 'content__no_results' })}
    />
  );
}

export { EmptySearch };
