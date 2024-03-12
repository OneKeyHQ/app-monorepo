import type { IRootStackNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { RootStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type { ERootRoutes } from '@onekeyhq/shared/src/routes';

export function RootNavigator({
  config,
}: {
  config: IRootStackNavigatorConfig<ERootRoutes, any>[];
}) {
  return <RootStackNavigator config={config} />;
}
