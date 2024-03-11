import { useIntl } from 'react-intl';

import { Page, Spinner, Stack } from '@onekeyhq/components';

export const PageLoading = () => {
  const intl = useIntl();
  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'title__address_book' })} />
      <Page.Body>
        <Stack h="100%" justifyContent="center" alignItems="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
};
