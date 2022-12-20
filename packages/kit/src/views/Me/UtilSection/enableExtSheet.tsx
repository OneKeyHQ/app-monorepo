import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Empty } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { showOverlay } from '../../../utils/overlayUtils';
import { OverlayPanel } from '../../Overlay/OverlayPanel';

export const EnableExtTips: FC<{
  enable?: boolean;
  onClose: () => void;
}> = ({ enable, onClose }) => {
  const intl = useIntl();
  return (
    <Box px={4} w="100%">
      <Empty
        emoji={enable ? '✅️' : '⏸️'}
        title={intl.formatMessage({
          id: enable ? 'title__extension_enabled' : 'title__extension_paused',
        })}
        subTitle={intl.formatMessage({
          id: enable
            ? 'title__extension_enabled_desc'
            : 'title__extension_paused_desc',
        })}
      />
      <Button
        onPress={() => {
          backgroundApiProxy.serviceSetting.disableExtSwitchTips();
          onClose();
        }}
        my={3}
      >
        {intl.formatMessage({ id: 'action__dont_show_again' })}
      </Button>
      <Button mb={6} type="primary" onPress={onClose}>
        {intl.formatMessage({ id: 'action__i_got_it' })}
      </Button>
    </Box>
  );
};

export const showEnableExtTipsSheet = ({ enable }: { enable?: boolean }) => {
  showOverlay((closeOverlay) => (
    <OverlayPanel
      closeOverlay={closeOverlay}
      modalProps={{ headerShown: false, hideBackButton: true }}
      modalLizeProps={{
        withHandle: true,
        handlePosition: 'inside',
        tapGestureEnabled: false,
      }}
    >
      <EnableExtTips enable={enable} onClose={closeOverlay} />
    </OverlayPanel>
  ));
};
