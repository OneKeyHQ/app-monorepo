import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { EModalRoutes } from '@onekeyhq/shared/src/routes';

import { modalRouter } from './router';

export function ModalNavigator() {
  return <RootModalNavigator<EModalRoutes> config={modalRouter} />;
}
