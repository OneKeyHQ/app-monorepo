import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  IconButton,
  Modal,
  NetImage,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';

import { useNavigation } from '../../../hooks';
import {
  getCurrentTabId,
  webTabsActions,
} from '../../../store/observable/webTabs';
import { wait } from '../../../utils/helper';
import { showOverlay } from '../../../utils/overlayUtils';
import { OverlayPanel } from '../../Overlay/OverlayPanel';
import { FallbackIcon } from '../components/DAppIcon';
import { useWebTabs } from '../Explorer/Controller/useWebTabs';
import {
  // MIN_OR_HIDE,
  WEB_TAB_CELL_GAP,
  hideTabGrid,
  // showTabGridAnim,
  tabGridRefs,
  // tabGridScrollY,
} from '../Explorer/explorerAnimation';

import type { WebTab } from '../../../store/observable/webTabs';
import type { FlatList } from 'react-native';

const WebTabItem: FC<WebTab> = ({ isCurrent, title, favicon, id, url }) => {
  const navigation = useNavigation();
  return (
    <Pressable
      w="full"
      px="2"
      mt={`${WEB_TAB_CELL_GAP}px`}
      onPress={() => {
        if (!isCurrent) {
          webTabsActions.setCurrentWebTab(id);
        }
        hideTabGrid(id);
        navigation.goBack();
      }}
    >
      <Box
        w="full"
        py="2"
        bg="surface-default"
        borderRadius="12px"
        borderWidth="1px"
        borderColor={isCurrent ? 'interactive-default' : 'border-subdued'}
        overflow="hidden"
      >
        <Box
          flex={1}
          collapsable={false}
          ref={(ref) => {
            // @ts-ignore
            tabGridRefs[id] = ref;
          }}
        >
          <Box
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
            />
            <Box flex="1" ml="8px" mr="4px">
              <Typography.CaptionStrong
                color="text-default"
                flex={1}
                textAlign="left"
                numberOfLines={1}
              >
                {title || 'Unknown'}
              </Typography.CaptionStrong>
              <Typography.Body2 color="text-subdued" numberOfLines={2}>
                {url}
              </Typography.Body2>
            </Box>
            <IconButton
              size="sm"
              type="plain"
              name="XMarkMini"
              onPress={() => {
                webTabsActions.closeWebTab(id);
              }}
            />
          </Box>
        </Box>
      </Box>
    </Pressable>
  );
};

export const MobileTabs = () => {
  const intl = useIntl();
  const ref = useRef<FlatList>();
  const navigation = useNavigation();
  const { tabs } = useWebTabs();
  const [loading, setLoading] = useState(false);
  const data = useMemo(() => tabs.slice(1), [tabs]);
  const renderItem = useCallback(
    ({ item: tab }: { item: WebTab }) => <WebTabItem {...tab} />,
    [],
  );
  const keyExtractor = useCallback((item: WebTab) => item.id, []);

  const closeAllTabs = useCallback(() => {
    showOverlay((closeOverlay) => (
      <OverlayPanel
        closeOverlay={closeOverlay}
        modalProps={{ headerShown: false }}
      >
        <PressableItem
          flexDirection="row"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            webTabsActions.closeAllWebTabs();
            navigation.goBack();
          }}
        >
          <Icon color="text-critical" size={24} name="XMarkMini" />
          <Typography.Body1Strong ml="12px" color="text-critical">
            {intl.formatMessage({
              id: 'action__close_all_tabs',
            })}
          </Typography.Body1Strong>
        </PressableItem>
      </OverlayPanel>
    ));
  }, [intl, navigation]);

  const onPress = useCallback(async () => {
    setLoading(true);
    try {
      await wait(100);
      webTabsActions.addBlankWebTab();
      await wait(100);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (ref.current) {
        const tabId = getCurrentTabId();
        const index = data.findIndex((tab) => tab.id === tabId);
        if (index > 1) {
          ref.current.scrollToIndex({ index, animated: true });
        }
      }
    }, 500);
  }, [data]);

  return (
    <Modal
      header={intl.formatMessage(
        { id: 'title__str_tabs' },
        { '0': data.length },
      )}
      flatListProps={{
        data,
        renderItem,
        keyExtractor,
        ref,
        showsVerticalScrollIndicator: false,
        onScrollToIndexFailed: async (info) => {
          await wait(500);
          if (ref.current) {
            ref.current.scrollToIndex({ index: info.index, animated: true });
          }
        },
      }}
      secondaryActionTranslationId="action__close_all"
      secondaryActionProps={{ onPress: closeAllTabs }}
      primaryActionTranslationId="action__add_new"
      primaryActionProps={{ onPress, isLoading: loading }}
    />
  );
};
