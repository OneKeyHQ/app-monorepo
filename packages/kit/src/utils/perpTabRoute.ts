import { perpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

// The Perps tab the sidebar shows for the current config, read at call time;
// undefined when Perps is disabled.
export async function getPerpTabRoute() {
  const { perpConfigCommon, perpConfigLoaded } =
    await perpsCommonConfigPersistAtom.get();
  // Mirrors usePerpTabConfig: the persisted disablePerp default only takes
  // effect after the remote config has actually loaded.
  if ((perpConfigLoaded ?? false) && perpConfigCommon?.disablePerp) {
    return undefined;
  }
  return perpConfigCommon?.usePerpWeb
    ? ETabRoutes.WebviewPerpTrade
    : ETabRoutes.Perp;
}
