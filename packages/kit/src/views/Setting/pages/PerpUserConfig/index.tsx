import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  Radio,
  YStack,
  rootNavigationRef,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsUserConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid/types';

import { ERootModalRoutes } from '../../../Developer/pages/Gallery/Components/stories/NavigatorRoute/Modal/Routes';

function PerpUserConfig() {
  const intl = useIntl();
  const [{ perpUserConfig }] = usePerpsUserConfigPersistAtom();
  const setPerpUserConfig = useCallback(async (type: EPerpUserType) => {
    startViewTransition(() => {
      void backgroundApiProxy.serviceWebviewPerp.setPerpUserConfig(type);
    });
  }, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perp_setting_interface,
        })}
      />
      <Page.Body>
        <YStack px="$5">
          <Radio
            value={perpUserConfig.currentUserType}
            onChange={(value) => {
              void setPerpUserConfig(value as EPerpUserType);
              setTimeout(() => {
                const rootState = rootNavigationRef.current?.getRootState();
                const routes = rootState?.routes;
                if (routes) {
                  const routesState = routes[0].state;
                  if (routesState) {
                    const index = routesState.index;
                    if (index !== undefined) {
                      const route = routesState.routes[index];
                      if (
                        route.name === ETabRoutes.WebviewPerpTrade &&
                        value === EPerpUserType.PERP_NATIVE
                      ) {
                        void rootNavigationRef.current?.navigate(
                          ERootRoutes.Main,
                          {
                            screen: ETabRoutes.Perp,
                            params: {
                              screen: ETabRoutes.Perp,
                            },
                          },
                          {
                            pop: true,
                          },
                        );
                      } else if (
                        route.name === ETabRoutes.Perp &&
                        value === EPerpUserType.PERP_WEB
                      ) {
                        void rootNavigationRef.current?.navigate(
                          ERootRoutes.Main,
                          {
                            screen: ETabRoutes.WebviewPerpTrade,
                            params: {
                              screen: ETabRoutes.WebviewPerpTrade,
                            },
                          },
                          {
                            pop: true,
                          },
                        );
                      }
                    }
                  }
                }
              }, 0);
            }}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_native_title,
                }),
                value: EPerpUserType.PERP_NATIVE,
                description: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_native_desc,
                }),
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_web_title,
                }),
                value: EPerpUserType.PERP_WEB,
                description: intl.formatMessage({
                  id: ETranslations.perp_setting_interface_web_desc,
                }),
              },
            ]}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default PerpUserConfig;
