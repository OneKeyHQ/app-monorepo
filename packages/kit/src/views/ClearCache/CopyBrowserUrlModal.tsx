import { useIntl } from 'react-intl';

import { Box, IconButton, Modal, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useClipboard } from '../../hooks/useClipboard';

export function browserSettingUrl() {
  if (platformEnv.isExtChrome) {
    if (platformEnv.isRuntimeEdge) {
      return 'edge://settings/clearBrowserData';
    }
    return 'chrome://settings/clearBrowserData';
  }
  if (platformEnv.isExtFirefox) {
    return 'about:preferences#privacy';
  }
}

const CopyBrowserUrlModal = () => {
  const intl = useIntl();
  const url = browserSettingUrl();
  const { copyText } = useClipboard();

  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__clear_cache' })}
      footer={null}
      staticChildrenProps={{ flex: 1 }}
    >
      <Box justifyContent="center" alignItems="center" height="200px">
        <Text typography="Body1Strong">
          {intl.formatMessage({
            id: 'title__open_this_link_in_browser',
          })}
        </Text>
        <Text mt="8px" typography="Body1" color="text-subdued">
          {browserSettingUrl()}
        </Text>
        <IconButton
          onPress={() => {
            copyText(url as string);
          }}
          mt="24px"
          name="DocumentDuplicateMini"
        >
          {intl.formatMessage({
            id: 'action__copy',
          })}
        </IconButton>
      </Box>
    </Modal>
  );
};

export default CopyBrowserUrlModal;
