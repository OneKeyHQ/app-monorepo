import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Text } from '@onekeyhq/components';

import { openUrl } from '../../../../../utils/openUrl';
import { MONERO_GUI_URL } from '../../../consts';

function XmrExtraInfo() {
  const intl = useIntl();

  const downloadMoneroGUILink = useCallback(
    (text) => (
      <Text
        color="text-default"
        onPress={() => openUrl(MONERO_GUI_URL)}
        typography="Body2Underline"
      >
        {text}
      </Text>
    ),
    [],
  );

  return (
    <Box paddingX="15px">
      <Alert
        dismiss={false}
        title={intl.formatMessage({
          id: 'msg__creating_more_monero_accounts_is_not_supported_for_the_moment',
        })}
        alertType="info"
        description={intl.formatMessage(
          {
            id: 'msg__creating_more_monero_accounts_is_not_supported_for_the_moment_desc',
          },
          {
            a: downloadMoneroGUILink,
          },
        )}
      />
    </Box>
  );
}

export { XmrExtraInfo };
