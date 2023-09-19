import { type FC, useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import {
  BottomSheetModal,
  Box,
  Center,
  Divider,
  HStack,
  Icon,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { homeTab, webTabsActions } from '../../../../store/observable/webTabs';
import { openUrlExternal } from '../../../../utils/openUrl';
import { showOverlay } from '../../../../utils/overlayUtils';
import { GasPanelRoutes } from '../../../GasPanel/types';
import { PriceBox } from '../../../GasPanel/widgets/PriceBox';
import { DiscoverModalRoutes } from '../../type';
import { useWebController } from '../Controller/useWebController';

const MoreMenu: FC<{ onClose: () => void }> = ({ onClose }) => {
  const intl = useIntl();
  const { currentTab, stopLoading, reload } = useWebController();
  const getCurrentUrl = useCallback(() => currentTab?.url ?? '', [currentTab]);

  const onReload = useCallback(() => {
    onClose();
    reload();
  }, [reload, onClose]);

  const onCopy = useCallback(() => {
    onClose();
    copyToClipboard(getCurrentUrl());
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__copied' }),
    });
  }, [intl, getCurrentUrl, onClose]);

  const onShare = useCallback(() => {
    setTimeout(() => {
      onClose();
      Share.share(
        Platform.OS === 'ios'
          ? {
              url: getCurrentUrl(),
            }
          : {
              message: getCurrentUrl(),
            },
      ).catch();
    }, 100);
  }, [getCurrentUrl, onClose]);

  const onHome = useCallback(() => {
    onClose();
    stopLoading();
    webTabsActions.setWebTabData({ ...homeTab, id: currentTab.id });
  }, [onClose, stopLoading, currentTab]);

  const onHandleBookmark = useCallback(() => {
    if (!currentTab) return;
    onClose();
    if (currentTab.isBookmarked) {
      backgroundApiProxy.serviceDiscover.removeFavorite(currentTab.url);
    } else {
      backgroundApiProxy.serviceDiscover.addFavorite(currentTab.url);
    }
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__success' }),
    });
  }, [currentTab, intl, onClose]);

  const onOpenInBrowser = useCallback(() => {
    onClose();
    openUrlExternal(getCurrentUrl());
  }, [getCurrentUrl, onClose]);

  const onBookmarks = useCallback(() => {
    onClose();
    getAppNavigation().navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.Favorites,
      },
    });
  }, [onClose]);

  const onHistory = useCallback(() => {
    onClose();
    getAppNavigation().navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.History,
      },
    });
  }, [onClose]);

  const onGasPanel = useCallback(() => {
    onClose();
    getAppNavigation().navigate(RootRoutes.Modal, {
      screen: ModalRoutes.GasPanel,
      params: {
        screen: GasPanelRoutes.GasPanelModal,
        params: {
          networkId: '',
        },
      },
    });
  }, [onClose]);

  return (
    <BottomSheetModal
      title={intl.formatMessage({ id: 'action__more' })}
      closeOverlay={onClose}
    >
      <Box>
        <HStack space={6}>
          <Pressable alignItems="center" onPress={onBookmarks}>
            <Center
              borderRadius={12}
              borderColor="border-subdued"
              borderWidth={1}
              w="12"
              h="12"
            >
              <Icon size={20} name="StarMini" />
            </Center>
            <Typography.Caption mt="2">
              {intl.formatMessage({ id: 'title__favorites' })}
            </Typography.Caption>
          </Pressable>
          <Pressable alignItems="center" onPress={onHistory}>
            <Center
              borderRadius={12}
              borderColor="border-subdued"
              borderWidth={1}
              w="12"
              h="12"
            >
              <Icon size={20} name="ClockMini" />
            </Center>
            <Typography.Caption mt="2">
              {intl.formatMessage({ id: 'transaction__history' })}
            </Typography.Caption>
          </Pressable>
          <Pressable alignItems="center" onPress={onGasPanel}>
            <PriceBox />
            <Typography.Caption mt="2">🔥Gas</Typography.Caption>
          </Pressable>
        </HStack>
        <Divider my="4" w="full" />
        <Box>
          <Pressable flexDirection="row" px="4" py="3" onPress={onReload}>
            <Box mr="3">
              <Icon name="ArrowPathOutline" />
            </Box>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'action__refresh',
              })}
            </Typography.Body1Strong>
          </Pressable>
          <Pressable flexDirection="row" px="4" py="3" onPress={onShare}>
            <Box mr="3">
              <Icon name="ShareOutline" />
            </Box>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'action__share',
              })}
            </Typography.Body1Strong>
          </Pressable>
          <Pressable flexDirection="row" px="4" py="3" onPress={onCopy}>
            <Box mr="3">
              <Icon name="LinkOutline" />
            </Box>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'action__copy_url',
              })}
            </Typography.Body1Strong>
          </Pressable>
          <Pressable
            flexDirection="row"
            px="4"
            py="3"
            onPress={onHandleBookmark}
          >
            <Box mr="3">
              <Icon name="SquaresPlusOutline" />
            </Box>
            <Typography.Body1Strong>
              {currentTab?.isBookmarked
                ? intl.formatMessage({
                    id: 'action__remove_from_favorites',
                  })
                : intl.formatMessage({
                    id: 'action__add_to_favorites',
                  })}
            </Typography.Body1Strong>
          </Pressable>
          <Pressable
            flexDirection="row"
            px="4"
            py="3"
            onPress={onOpenInBrowser}
          >
            <Box mr="3">
              <Icon name="GlobeAltOutline" />
            </Box>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'action__open_in_browser',
              })}
            </Typography.Body1Strong>
          </Pressable>
          <Pressable flexDirection="row" px="4" py="3" onPress={onHome}>
            <Box mr="3">
              <Icon name="HomeOutline" />
            </Box>
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'action__back_to_home_page',
              })}
            </Typography.Body1Strong>
          </Pressable>
        </Box>
      </Box>
    </BottomSheetModal>
  );
};

export const showWebMoreMenu = () =>
  showOverlay((onClose) => <MoreMenu onClose={onClose} />);
