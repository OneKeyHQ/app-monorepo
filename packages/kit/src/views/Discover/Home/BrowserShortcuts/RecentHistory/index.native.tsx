import { type FC, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Menu,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../../routes/routesEnum';
import { type ValidOption } from '../../../../Overlay/BaseMenu';
import { DiscoverModalRoutes } from '../../../type';
import { DiscoverContext } from '../../context';
import { Favicon } from '../Favicon';

import type { MatchDAppItemType } from '../../../Explorer/explorerUtils';
import type { MessageDescriptor } from 'react-intl';

type RecentHistoryProps = {
  item: MatchDAppItemType;
};

export const RecentHistory: FC<RecentHistoryProps> = ({ item }) => {
  const logoURL = item.dapp?.logoURL || item.webSite?.favicon || '';
  const name = item.dapp?.name || item.webSite?.title || '';
  const url = item.dapp?.url || item.webSite?.url || '';

  const intl = useIntl();
  const navigation = useNavigation();
  const [isOpen, setOpen] = useState(false);

  const options = useMemo(
    () =>
      [
        {
          id: 'action__share',
          onPress: () => {
            setOpen(false);
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
          icon: 'ShareMini',
        },
        {
          id: 'action__copy_url',
          onPress: () => {
            copyToClipboard(url);
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__success' }),
            });
            setOpen(false);
          },
          icon: 'LinkMini',
        },
        {
          id: 'action__delete',
          variant: 'desctructive',
          onPress: () => {
            setOpen(false);
            backgroundApiProxy.serviceDiscover.removeMatchItem(item);
            setTimeout(() => {
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__success' }),
              });
            }, 300);
          },
          icon: 'TrashMini',
        },
      ] as (ValidOption & { id: MessageDescriptor['id'] })[],
    [url, intl, item, navigation, logoURL, name],
  );

  const { onItemSelectHistory } = useContext(DiscoverContext);
  const onPress = useCallback(() => {
    onItemSelectHistory({
      id: item.id,
      webSite: { title: name, url, favicon: logoURL },
    });
  }, [onItemSelectHistory, item, logoURL, name, url]);

  return (
    <Menu
      width={200}
      placement="bottom right"
      onClose={() => setOpen(false)}
      isOpen={isOpen}
      // eslint-disable-next-line
      trigger={(triggerProps) => {
        return (
          <Pressable
            {...triggerProps}
            onPress={onPress}
            onLongPress={() => setOpen(true)}
          >
            {({ isHovered, isPressed }) => (
              <Box
                py="2"
                borderRadius={12}
                justifyContent="center"
                alignItems="center"
              >
                <Favicon
                  logoURL={logoURL}
                  url={url}
                  isHovered={isHovered || isPressed}
                />
                <Typography.Caption
                  w="16"
                  mt="2"
                  numberOfLines={2}
                  textAlign="center"
                  noOfLines={2}
                >
                  {name ?? 'Unknown'}
                </Typography.Caption>
              </Box>
            )}
          </Pressable>
        );
      }}
    >
      {options.map((option) => (
        <Menu.CustomItem
          key={option.icon}
          icon={option.icon}
          onPress={option.onPress}
        >
          {intl.formatMessage({ id: option.id })}
        </Menu.CustomItem>
      ))}
    </Menu>
  );
};
