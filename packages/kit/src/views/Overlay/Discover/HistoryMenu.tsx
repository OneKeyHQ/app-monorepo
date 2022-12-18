import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Icon,
  Text,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { showOverlay } from '../../../utils/overlayUtils';
import { DiscoverModalRoutes } from '../../Discover/type';
import { OverlayPanel } from '../OverlayPanel';

import type { MatchDAppItemType } from '../../Discover/Explorer/explorerUtils';
import type { ShowMenuProps } from './type';
import type { MessageDescriptor } from 'react-intl';

const DiscoverHistoryMenu: FC<{
  closeOverlay: () => void;
  item: MatchDAppItemType;
}> = ({ closeOverlay, item }) => {
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();
  const toast = useToast();
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
          toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
        },
        icon: 'LinkMini',
      },
      {
        id: 'action__remove',
        onPress: () => {
          backgroundApiProxy.serviceDiscover.removeMatchItem(item);
          toast.show({
            title: intl.formatMessage({ id: 'transaction__success' }),
          });
        },
        icon: 'TrashMini',
        isDanger: true,
      },
    ],
    [item, toast, intl, isVerticalLayout, navigation],
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

export const showHistoryMenu: ShowMenuProps = ({ dapp, title, triggerEle }) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={{
        header: title ?? formatMessage({ id: 'action__more' }),
      }}
    >
      <DiscoverHistoryMenu closeOverlay={closeOverlay} item={dapp} />
    </OverlayPanel>
  ));
