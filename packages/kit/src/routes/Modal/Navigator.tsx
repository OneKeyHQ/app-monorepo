import { EPageType } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { modalRouter } from './router';

export function ModalNavigator({ pageType }: { pageType?: EPageType }) {
  return (
    <RootModalNavigator<EModalRoutes>
      config={modalRouter}
      pageType={pageType}
    />
  );
}

export function iOSFullScreenNavigator() {
  return <ModalNavigator pageType={EPageType.fullScreen} />;
}
