import { useIntl } from 'react-intl';

import { Button, Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptySearch({ onManageToken }: { onManageToken?: () => void }) {
  const intl = useIntl();
  return (
    <Empty
      testID="Wallet-No-Search-Empty"
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_search_no_results_title,
      })}
      description={intl.formatMessage({
        id: ETranslations.manage_token_empty_msg,
      })}
      button={
        <Button mt="$6" size="medium" variant="primary" onPress={onManageToken}>
          {intl.formatMessage({
            id: ETranslations.manage_token_custom_token_button,
          })}
        </Button>
      }
    />
  );
}

export { EmptySearch };
