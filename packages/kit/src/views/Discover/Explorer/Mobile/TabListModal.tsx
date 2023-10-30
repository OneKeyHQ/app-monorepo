import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { FlatList } from 'react-native';

import { IconButton, ModalContainer, Stack, Text } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useWebTabs } from '../../Controller/useWebTabs';
import { webTabsActions, withProviderWebTabs } from '../Context/contextWebTabs';

import type { DiscoverModalParamList } from '../../types';
import type { WebTab } from '../Context/contextWebTabs';
import type { View } from 'react-native';

export const tabGridRefs: Record<string, View> = {};

const WebTabItem: FC<WebTab> = ({ isCurrent, title, favicon, id, url }) => {
  const navigation =
    useAppNavigation<PageNavigationProp<DiscoverModalParamList>>();
  return (
    <Stack
      w="full"
      px="2"
      mt="$4"
      onPress={() => {
        if (!isCurrent) {
          webTabsActions.setCurrentWebTab(id);
        }
        navigation.pop();
      }}
    >
      <Stack
        w="full"
        py="$1"
        bg="$background-default"
        borderRadius="$3"
        borderWidth={1}
        borderColor={isCurrent ? '$borderActive' : '$borderCritical'}
        overflow="hidden"
      >
        <Stack
          flex={1}
          collapsable={false}
          ref={(ref) => {
            // @ts-ignore
            tabGridRefs[id] = ref;
          }}
        >
          {/* <Box
            px="2"
            w="full"
            borderTopLeftRadius="12px"
            borderTopRightRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <NetImage
              key={favicon}
              width="40px"
              height="40px"
              borderRadius="12px"
              src={favicon}
              bgColor="surface-neutral-default"
              fallbackElement={
                <Box
                  borderRadius={12}
                  borderWidth={1}
                  borderColor="border-subdued"
                >
                  <FallbackIcon size={40} />
                </Box>
              }
            /> */}
          <Stack flex={1} ml="$2" mr="$1">
            <Text color="$text" flex={1} textAlign="left" numberOfLines={1}>
              {title || 'Unknown'}
            </Text>
            <Text color="$text" numberOfLines={2}>
              {url}
            </Text>
          </Stack>
          <IconButton
            size="small"
            variant="primary"
            icon="CrossedSmallOutline"
            onPress={() => {
              webTabsActions.closeWebTab(id);
            }}
          />
          {/* </Box> */}
        </Stack>
      </Stack>
    </Stack>
  );
};

function TabListModal() {
  const { tabs } = useWebTabs();
  const data = useMemo(() => tabs.slice(1), [tabs]);
  const keyExtractor = useCallback((item: WebTab) => item.id, []);
  const renderItem = useCallback(
    ({ item: tab }: { item: WebTab }) => <WebTabItem {...tab} />,
    [],
  );
  return (
    <ModalContainer
      onConfirm={() => webTabsActions.addBlankWebTab()}
      onCancel={() => webTabsActions.closeAllWebTabs()}
    >
      <FlatList
        style={{ width: '100%', height: 200 }}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
      />
    </ModalContainer>
  );
}

export default withProviderWebTabs(TabListModal);
