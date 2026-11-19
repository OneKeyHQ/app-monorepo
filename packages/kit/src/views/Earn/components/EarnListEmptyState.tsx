import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

/**
 * The Earn list pages rendered `null` once loading finished, so a search or
 * network filter that matched nothing left a blank page.
 *
 * The two empty states are deliberately different. A filtered miss is the
 * user's own query coming back empty. An unfiltered miss means the data itself
 * is absent — telling the user "no search results" there would misread an
 * outage or an empty category as something they typed.
 */
export function EarnListEmptyState({
  isFiltered,
  onReset,
}: {
  isFiltered: boolean;
  /** Clears the filters a miss came from, where a list sets some itself */
  onReset?: () => void;
}) {
  const intl = useIntl();

  if (isFiltered) {
    return (
      <Empty
        px="$pagePadding"
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search_no_results_title,
        })}
        buttonProps={
          onReset
            ? {
                children: intl.formatMessage({
                  id: ETranslations.global_reset,
                }),
                onPress: onReset,
              }
            : undefined
        }
      />
    );
  }

  return (
    <Empty
      px="$pagePadding"
      icon="PlaceholderOutline"
      title={intl.formatMessage({ id: ETranslations.global_no_data })}
    />
  );
}
