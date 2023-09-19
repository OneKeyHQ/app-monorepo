import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { BottomSheetModal, Box, Button, Empty } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { showOverlay } from '../../utils/overlayUtils';

export const RefreshExtTips: FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const intl = useIntl();
  return (
    <Box px={4} w="100%">
      <Empty
        emoji="🔄"
        title={intl.formatMessage({
          id: 'title__re_enable_extension_mannually',
        })}
        subTitle={intl.formatMessage({
          id: 'title__re_enable_extension_mannually_desc',
        })}
      />
      <Button
        mt={4}
        type="primary"
        onPress={() => {
          if (platformEnv.isExtension) {
            chrome.runtime.reload();
          } else if (platformEnv.isWeb) {
            window.location.reload();
          }
          onClose();
        }}
      >
        {intl.formatMessage({ id: 'action__restart' })}
      </Button>
    </Box>
  );
};

export const showRefreshExtSheet = () => {
  showOverlay((closeOverlay) => (
    <BottomSheetModal
      title=""
      closeOverlay={closeOverlay}
      showHeader={false}
      modalLizeProps={{
        withHandle: true,
        handlePosition: 'inside',
        tapGestureEnabled: false,
      }}
    >
      <RefreshExtTips onClose={closeOverlay} />
    </BottomSheetModal>
  ));
};
