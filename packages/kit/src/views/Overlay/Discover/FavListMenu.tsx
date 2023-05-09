import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ToastManager, useIsVerticalLayout } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { DiscoverModalRoutes } from '../../Discover/type';
import BaseMenu from '../BaseMenu';

import type { MatchDAppItemType } from '../../Discover/Explorer/explorerUtils';
import type { IBaseMenuOptions, IMenu } from '../BaseMenu';

const FavListMenu: FC<IMenu & { item: MatchDAppItemType; isFav?: boolean }> = ({
  item,
  isFav,
  ...props
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const bookmarks = useAppSelector((s) => s.discover.bookmarks);
  const navigation = useNavigation();
  const options: IBaseMenuOptions = useMemo(
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
          setTimeout(() => {
            const url = item?.dapp?.url || item?.webSite?.url || '';
            copyToClipboard(url);
          }, 600);
          ToastManager.show({
            title: intl.formatMessage({ id: 'msg__copied' }),
          });
        },
        icon: 'LinkMini',
      },
      isFav && {
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
          if (isFav) {
            backgroundApiProxy.serviceDiscover.removeFavorite(item.id);
          } else {
            backgroundApiProxy.serviceDiscover.removeMatchItem(item);
          }
          ToastManager.show({
            title: intl.formatMessage({ id: 'transaction__success' }),
          });
        },
        icon: 'TrashMini',
        variant: 'desctructive',
      },
    ],
    [isVerticalLayout, isFav, item, navigation, intl, bookmarks],
  );
  return <BaseMenu options={options} {...props} />;
};

export default FavListMenu;
