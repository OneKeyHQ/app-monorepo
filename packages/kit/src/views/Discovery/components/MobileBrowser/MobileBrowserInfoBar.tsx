import { useMemo } from 'react';

import { Image, Stack, Text } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
// @ts-expect-error
import dAppFavicon from '@onekeyhq/kit/assets/dapp_favicon.png';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import { useWebTabData } from '../../hooks/useWebTabs';
import {
  type DiscoverModalParamList,
  DiscoverModalRoutes,
} from '../../router/Routes';
import { gotoSite } from '../../utils/gotoSite';

function MobileBrowserInfoBar({ id }: { id: string }) {
  const navigation =
    useAppNavigation<PageNavigationProp<DiscoverModalParamList>>();
  const { tab } = useWebTabData(id);
  const content = useMemo(
    () => (
      <Stack
        w="100%"
        h="$12"
        px="$3"
        py="$2"
        flexDirection="row"
        alignItems="center"
        onPress={() => {
          navigation.pushModal(ModalRoutes.DiscoverModal, {
            screen: DiscoverModalRoutes.SearchModal,
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

export default MobileBrowserInfoBar;
