import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';

import { getSwapHistoryListTitleId } from '../../utils/swapMarketHistory';

import type { RouteProp } from '@react-navigation/core';

// Loading placeholder for the lazy-loaded SwapHistoryListModal. It already shows
// the entry's category as the header title (read from the route param) so the
// title does not flash from the static route default to the real dropdown title
// while the modal chunk is loading.
export default function SwapHistoryListModalFallback() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const title = useMemo(
    () =>
      intl.formatMessage({
        id: getSwapHistoryListTitleId(route.params?.type),
      }),
    [intl, route.params?.type],
  );
  return (
    <Page>
      <Page.Header title={title} />
      <Page.Body>
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}
