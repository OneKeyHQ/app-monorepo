import { RootSiblingParent } from 'react-native-root-siblings';

import { AccountSelectorRootProvidersAutoMount } from '../../components/AccountSelector';

import { AppStateLockContainer } from './AppStateLockContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { KeyboardContainer } from './KeyboardContainer';
import { NavigationContainer } from './NavigationContainer';
import { PortalBodyContainer } from './PortalBodyContainer';

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <KeyboardContainer />
        <NavigationContainer>
          <AccountSelectorRootProvidersAutoMount />
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
        </NavigationContainer>
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
