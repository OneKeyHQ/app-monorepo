import { useIntl } from 'react-intl';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const PageLoading = () => {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.address_book_title })}
      />
      <Page.Body>
        <Stack h="100%" justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
};
