import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Icon,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { showOverlay } from '../../../utils/overlayUtils';
import { DiscoverModalRoutes } from '../../Discover/type';
import { OverlayPanel } from '../OverlayPanel';

import type { MatchDAppItemType } from '../../Discover/Explorer/explorerUtils';
import type { ShowMenuProps } from './type';
import type { MessageDescriptor } from 'react-intl';

const DiscoverFavoriteMenu: FC<{
  closeOverlay: () => void;
  item: MatchDAppItemType;
}> = ({ closeOverlay, item }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const bookmarks = useAppSelector((s) => s.discover.bookmarks);

  const navigation = useNavigation();
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
        isDanger?: boolean;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      isVerticalLayout
        ? {
            id: 'title__share',
            onPress: () => {
              const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
              const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
              const url = item.dapp?.url ?? item.webSite?.url ?? '';
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Discover,
                params: {
                  screen: DiscoverModalRoutes.ShareModal,
                  params: {
                    url,
                    name,
                    logoURL,
                  },
                },
              });
            },
            icon: 'ShareOutline',
          }
        : false,
      {
        id: 'action__copy_url',
        onPress: () => {
          copyToClipboard(item?.dapp?.url ?? item?.webSite?.url ?? '');
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__copied' }),
          });
        },
        icon: 'LinkOutline',
      },
      {
        id: 'action__edit',
        onPress: () => {
          const url = item.dapp?.url ?? item.webSite?.url ?? '';
          const bookmark = bookmarks?.find((o) => o.url === url);
          if (!bookmark) {
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__engine__internal_error' }),
            });
            return;
          }
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Discover,
            params: {
              screen: DiscoverModalRoutes.EditBookmark,
              params: {
                bookmark,
              },
            },
          });
        },
        icon: 'PencilAltOutline',
      },
      {
        id: 'action__remove',
        onPress: () => {
          backgroundApiProxy.serviceDiscover.removeFavorite(item.id);
          ToastManager.show({
            title: intl.formatMessage({ id: 'transaction__success' }),
          });
        },
        icon: 'TrashOutline',
        isDanger: true,
      },
    ],
    [item, intl, isVerticalLayout, navigation, bookmarks],
  );
  return (
    <Box bg="surface-subdued" flexDirection="column">
      {options.filter(Boolean).map(({ onPress, icon, id, isDanger }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon
            size={isVerticalLayout ? 24 : 20}
            name={icon}
            color={isDanger ? 'text-critical' : 'text-default'}
          />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
            color={isDanger ? 'text-critical' : 'text-default'}
          >
            {intl.formatMessage({
              id,
            })}
          </Text>
        </PressableItem>
      ))}
    </Box>
  );
};

export const showFavoriteMenu: ShowMenuProps = ({ triggerEle, dapp, title }) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={{
        header: title ?? formatMessage({ id: 'action__more' }),
      }}
    >
      <DiscoverFavoriteMenu closeOverlay={closeOverlay} item={dapp} />
    </OverlayPanel>
  ));
