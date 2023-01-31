import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Empty } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { showOverlay } from '../../../utils/overlayUtils';
import { OverlayPanel } from '../../Overlay/OverlayPanel';

export const EnableExtTips: FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const intl = useIntl();
  return (
    <Box px={4} w="100%">
      <Empty
        emoji="🔄"
        title={intl.formatMessage({
          id: 'title__refresh_website_to_take_effect',
        })}
        subTitle={intl.formatMessage({
          id: 'title__refresh_website_to_take_effect_desc',
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

export const showEnableExtTipsSheet = () => {
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
      <EnableExtTips onClose={closeOverlay} />
    </OverlayPanel>
  ));
};
