import { useIntl } from 'react-intl';

import { Empty, KeyboardDismissView } from '@onekeyhq/components';

export const NetworkListEmpty = () => {
  const intl = useIntl();
  return (
    <KeyboardDismissView>
      <Empty
        flex="1"
        emoji="🔍"
        title={intl.formatMessage({
          id: 'content__no_results',
          defaultMessage: 'No Result',
        })}
      />
    </KeyboardDismissView>
  );
};

export const strIncludes = (a: string, b: string) =>
  a.toLowerCase().includes(b.toLowerCase());
