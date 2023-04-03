/* eslint-disable arrow-body-style, @typescript-eslint/no-unused-vars */
import { useEffect } from 'react';

import { LayoutHeaderMobile } from '@onekeyhq/components/src/Layout/Header/LayoutHeaderMobile';
import { WalletSelectorNavHeader } from '@onekeyhq/components/src/Layout/Header/WalletSelectorNavHeader';
import NavHeader from '@onekeyhq/components/src/NavHeader/NavHeader';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../../../hooks';

import type { TabRoutes } from '../../../routesEnum';
import type {
  ScreensListItem,
  TabRouteConfig,
  TabRouteConfigNavHeaderType,
} from '../../../types';
import type { MessageDescriptor } from 'react-intl';

export function useHideTabNavigatorHeader() {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
}

export function buildTabNavigatorHeaderRender() {
  if (platformEnv.isNewRouteMode) {
    // we don't need to render TabNavigatorHeader in new route mode
    // use TabScreenHeader both in desktop and mobile
    return () => null;
  }
  // eslint-disable-next-line react/display-name
  return () => <LayoutHeaderMobile />;
}

// this headerRender only works in mobile
// desktop header please check: packages/kit/src/views/Swap/Desktop.tsx
export function buildTabScreenHeaderRender({
  tab,
  index,
  name,
  i18nTitle,
  stackOptions,
  bgColor,
  borderBottomColor,
  isVerticalLayout,
}: {
  tab: TabRouteConfig;
  index: number;
  name: string;
  i18nTitle?: MessageDescriptor['id'];
  stackOptions: Omit<ScreensListItem<string>, 'name' | 'component'>;
  bgColor: string;
  borderBottomColor: string;
  isVerticalLayout: boolean;
}) {
  let headerShown = true;
  if (index === 0) {
    if (isVerticalLayout && tab.hideMobileNavHeader) {
      headerShown = false;
    }
    if (!isVerticalLayout && tab.hideDesktopNavHeader) {
      headerShown = false;
    }
  } else {
    headerShown = true;
  }

  const navHeaderType: TabRouteConfigNavHeaderType | undefined =
    index === 0 ? tab.navHeaderType : 'SimpleTitle';

  const headerRender =
    navHeaderType === 'AccountSelector'
      ? // **** render shared walletSelector & accountSelector Header
        (props: any) => {
          // console.log('LayoutHeaderDesktop >>>>> ', props);
          return <WalletSelectorNavHeader i18nTitle={i18nTitle} />;
        }
      : // **** render Simple built-in Title Header
        (props: any) => {
          // console.log('NavHeader >>>>> ', props);
          return (
            <NavHeader
              style={{
                backgroundColor: bgColor,
                borderBottomWidth: 0,
                shadowColor: borderBottomColor,
              }}
              {...props}
              {...stackOptions}
            />
          );
        };

  return { headerRender, headerShown };
}
