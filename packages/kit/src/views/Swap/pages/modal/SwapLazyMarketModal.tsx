import { useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type { IPageScreenProps } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useLazyMarketTradeActions } from '@onekeyhq/kit/src/views/Market/components/tradeHook';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function BaseSwapLazyMarketModalModal({
  route,
}: IPageScreenProps<
  IModalSwapParamList,
  EModalSwapRoutes.SwapLazyMarketModal
>) {
  const { coinGeckoId } = route.params;
  const intl = useIntl();

  const { onSwap } = useLazyMarketTradeActions(coinGeckoId);

  useLayoutEffect(() => {
    void onSwap();
  }, [onSwap]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_trade })}
      />
      <Page.Body>
        <Stack flex={1} ai="center" jc="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default function SwapLazyMarketModal(
  props: IPageScreenProps<
    IModalSwapParamList,
    EModalSwapRoutes.SwapLazyMarketModal
  >,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BaseSwapLazyMarketModalModal {...props} />
    </AccountSelectorProviderMirror>
  );
}
