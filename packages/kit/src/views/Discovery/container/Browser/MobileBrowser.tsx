import { memo, useCallback, useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Freeze } from 'react-freeze';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import { THUMB_HEIGHT, THUMB_WIDTH } from '../../config/TabList.constants';
import { useTabDataFromSimpleDb } from '../../hooks/useTabDataFromSimpleDb';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import {
  displayHomePageAtom,
  useAtomWebTabs,
} from '../../store/contextWebTabs';
import { captureViewRefs } from '../../utils/explorerUtils';
import { gotoSite } from '../../utils/gotoSite';
import { checkAndCreateFolder } from '../../utils/screenshot';
import Dashboard from '../Dashboard';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IDiscoveryModalParamList } from '../../router/Routes';

function HandleRebuildTabBarData() {
  const result = useTabDataFromSimpleDb();
  const { setWebTabs, addBlankWebTab } = useWebTabAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      void setWebTabs({ data });
    }
  }, [result.result, addBlankWebTab, setWebTabs]);

  return null;
}

function MobileBrowser() {
  const navigationCore = useNavigation();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabData(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { displayHomePage } = useDisplayHomePageFlag();

  useEffect(() => {
    console.log('MobileBrowser renderer ===> : ');
    navigationCore.setOptions({
      headerShown: false,
      animation: 'none',
    });
    void checkAndCreateFolder();
  }, [navigationCore]);

  const content = useMemo(
    () => tabs.map((t) => <MobileBrowserContent id={t.id} key={t.id} />),
    [tabs],
  );
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    console.log('MobileBrowser displayHomePage ===> : ', displayHomePage);
  }, [displayHomePage]);

  const takeScreenshot = useCallback(
    async () =>
      new Promise<boolean>((resolve, reject) => {
        captureRef(captureViewRefs[activeTabId ?? ''], {
          format: 'jpg',
          quality: 0.2,
          width: THUMB_WIDTH,
          height: THUMB_HEIGHT,
        })
          .then(async (imageUri) => {
            console.log('imgUrl: ', imageUri);
            resolve(true);
          })
          .catch((e) => {
            console.log('capture error e: ', e);
            reject(e);
          });
      }),
    [activeTabId],
  );

  return (
    <Stack flex={1} zIndex={3} pt={top} bg="$bgApp">
      <HandleRebuildTabBarData />
      {displayHomePage ? (
        <Stack flex={1}>
          <Text>Dashboard</Text>
          <Dashboard />
        </Stack>
      ) : (
        <MobileBrowserInfoBar
          id={activeTabId ?? ''}
          url={tab?.url ?? ''}
          onSearch={() => {
            navigation.pushModal(EModalRoutes.DiscoveryModal, {
              screen: EDiscoveryModalRoutes.SearchModal,
              params: {
                onSubmitContent: (text: string) => {
                  console.log('onSubmitContent: ===> : ', text);
                  gotoSite({
                    url: text,
                    isNewWindow: false,
                    userTriggered: true,
                  });
                },
              },
            });
          }}
        />
      )}
      <Freeze freeze={displayHomePage}>{content}</Freeze>
      <Freeze freeze={displayHomePage}>
        <MobileBrowserBottomBar id={activeTabId ?? ''} />
      </Freeze>
    </Stack>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
