import { FC, useMemo } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';

import {
  Box,
  Divider,
  ICON_NAMES,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { SelectProps } from '@onekeyhq/components/src/Select';
import { useCheckUpdate } from '@onekeyhq/kit/src/hooks/useCheckUpdate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAutoUpdate } from '../../hooks/redux';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';

import { OverlayPanel } from './OverlayPanel';

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

  const { state } = useAutoUpdate();
  const { showUpdateBadge } = useCheckUpdate();
  const UpdateItem = useMemo(() => {
    let formText = '';
    const disabled = state === 'downloading';
    if (state === 'available') {
      formText = intl.formatMessage({ id: 'action__update_available' });
    } else if (state === 'ready') {
      formText = intl.formatMessage({ id: 'action__update_now' });
    }
    if (!formText) {
      return null;
    }
    return (
      <PressableItem
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        py={{ base: '12px', sm: '8px' }}
        px={{ base: '16px', sm: '8px' }}
        mt="4px"
        bg="transparent"
        borderRadius="12px"
        onPress={() => {
          if (state === 'ready') {
            window.desktopApi.installUpdate();
          } else {
            window.desktopApi.downloadUpdate();
          }
        }}
        disabled={disabled}
      >
        <Box flexDirection="row" alignItems="center">
          <Icon size={isVerticalLayout ? 24 : 20} name="UploadOutline" />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
          >
            {formText}
          </Text>
        </Box>

        {showUpdateBadge && (
          <Box rounded="full" p="2px" pr="9px">
            <Box rounded="full" bgColor="interactive-default" size="8px" />
          </Box>
        )}
      </PressableItem>
    );
  }, [state, intl, isVerticalLayout, showUpdateBadge]);

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
      <Divider />
      {UpdateItem}
    </Box>
  );
};

export const showHomeMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel triggerEle={triggerEle} closeOverlay={closeOverlay}>
      <HomeMoreSettings closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
