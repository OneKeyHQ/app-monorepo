import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { modalRouter } from './router';

import type { EModalRoutes } from './type';

export function ModalNavigator() {
  return <RootModalNavigator<EModalRoutes> config={modalRouter} />;
}
