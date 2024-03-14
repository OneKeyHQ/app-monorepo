import { useEffect, useState } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import { Toast } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AppStateLockContainer } from './AppStateLockContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { HardwareUiStateContainer } from './HardwareUiStateContainer';
import { KeyboardContainer } from './KeyboardContainer';
import { NavigationContainer } from './NavigationContainer';
import { PortalBodyContainer } from './PortalBodyContainer';

function ErrorToastContainer() {
  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      Toast[p.method](p);
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, []);

  return null;
}

function FlipperPluginsContainer() {
  console.log('FlipperPluginsContainer render');
  const [, setRealmReady] = useState(false);
  useEffect(() => {
    if (global.$$realm) {
      return;
    }
    const fn = () => {
      console.log('FlipperPluginsContainer realm ready');
      setRealmReady(true);
    };
    appEventBus.on(EAppEventBusNames.RealmInit, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.RealmInit, fn);
    };
  }, []);
  const realmPlugin = (() => {
    if (process.env.NODE_ENV !== 'production') {
      const realm = global.$$realm;
      if (realm && platformEnv.isNative) {
        console.log('render realm plugin');
        const RealmFlipperPlugin = (
          require('@onekeyhq/shared/src/modules3rdParty/realm-flipper-plugin-device') as typeof import('@onekeyhq/shared/src/modules3rdParty/realm-flipper-plugin-device/index.native')
        ).default;
        return <RealmFlipperPlugin realms={[global.$$realm]} />;
      }
    }
    return null;
  })();
  return <>{realmPlugin}</>;
}

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <KeyboardContainer />
        <NavigationContainer>
          <JotaiContextRootProvidersAutoMount />
          <HardwareUiStateContainer />
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
          <ErrorToastContainer />
          {process.env.NODE_ENV !== 'production' ? (
            <>
              <FlipperPluginsContainer />
            </>
          ) : null}
        </NavigationContainer>
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
