import { useMemo } from 'react';

import { Image } from 'react-native';

import { Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
// @ts-expect-error
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import { gotoSite } from '../../Controller/gotoSite';
import { useWebTabs } from '../../Controller/useWebTabs';
import { type DiscoverModalParamList, DiscoverModalRoutes } from '../../types';
import { atomWebTabsMap, useAtomWebTabs } from '../Context/contextWebTabs';

function BrowserInfoBar() {
  const navigation =
    useAppNavigation<IPageNavigationProp<DiscoverModalParamList>>();
  const { currentTabId } = useWebTabs();
  const [map] = useAtomWebTabs(atomWebTabsMap);
  const tab = map[currentTabId || ''];
  console.log('=====>>>>>>currentTab: ', tab.url, tab.title);
  const content = useMemo(
    () => (
      <Stack
        w="full"
        h="$12"
        px="$3"
        py="$2"
        flexDirection="row"
        alignItems="center"
        onPress={() => {
          navigation.pushModal(ModalRoutes.DiscoverModal, {
            screen: DiscoverModalRoutes.SearchModal,
            params: {
              onSubmitContent: (text) => {
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
      >
        <Image
          style={{ width: 16, height: 16, marginRight: 8 }}
          source={{ uri: tab?.favicon }}
          defaultSource={dAppFavicon}
        />
        <Text>{tab?.title}</Text>
      </Stack>
    ),
    [tab?.title, tab?.favicon, navigation],
  );
  return <>{content}</>;
}

export default BrowserInfoBar;
