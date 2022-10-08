import { FC, useMemo } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';

import {
  Box,
  ICON_NAMES,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { SelectProps } from '@onekeyhq/components/src/Select';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';

import { OverlayPanel } from './OverlayPanel';
import UpdateItem from './UpdateItem';

const HomeMoreSettings: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
}) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: isVerticalLayout ? 'ScanOutline' : 'ScanSolid',
      },
      platformEnv.isExtensionUiPopup && {
        id: 'form__expand_view',
        onPress: () => {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: '',
          });
        },
        icon: 'ArrowsExpandOutline',
      },
      {
        id: 'action__lock_now',
        onPress: () => backgroundApiProxy.serviceApp.lock(true),
        icon: isVerticalLayout ? 'LockClosedOutline' : 'LockClosedSolid',
      },
    ],
    [isVerticalLayout],
  );

  return (
    <Box bg="surface-subdued" flexDirection="column">
      {options.filter(Boolean).map(({ onPress, icon, id }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon size={isVerticalLayout ? 24 : 20} name={icon} />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
          >
            {intl.formatMessage({
              id,
            })}
          </Text>
        </PressableItem>
      ))}
      <UpdateItem />
    </Box>
  );
};

export const showHomeMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel triggerEle={triggerEle} closeOverlay={closeOverlay}>
      <HomeMoreSettings closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
