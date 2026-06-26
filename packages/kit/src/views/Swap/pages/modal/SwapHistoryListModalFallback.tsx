import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import type { RouteProp } from '@react-navigation/core';

function getSwapHistoryListTitleId(type?: EProtocolOfExchange) {
  if (type === EProtocolOfExchange.STOCK) {
    return ETranslations.perps_token_selector_stocks;
  }
  if (type === EProtocolOfExchange.LIMIT) {
    return ETranslations.swap_page_limit_dialog_title;
  }
  return ETranslations.swap_history_title;
}

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
