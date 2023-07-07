import { useIntl } from 'react-intl';

import { Text } from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

import { useNetwork } from '../../../../../hooks';
import { openUrl } from '../../../../../utils/openUrl';
import { MONERO_GUI_URL } from '../../../consts';

function XmrDisabledInfo() {
  const intl = useIntl();

  return (
    <>
      <Text typography="Body1">
        {intl.formatMessage({
          id: 'msg__hardware_wallet_connection_is_only_available_on_the_official_app',
        })}
      </Text>
      <Pressable onPress={() => openUrl(MONERO_GUI_URL)}>
        <Text typography="Body1" color="text-success">
          {intl.formatMessage(
            {
              id: 'action__download_str',
            },
            {
              0: 'Monero GUI',
            },
          )}
        </Text>
      </Pressable>
    </>
  );
}

function HardwareDisabledInfo({ networkId }: { networkId: string }) {
  const intl = useIntl();
  const { network } = useNetwork({ networkId });
  return (
    <Text typography="Body1">
      {intl.formatMessage(
        {
          id: 'content__str_chain_is_unsupprted',
        },
        {
          0: network?.name,
        },
      )}
    </Text>
  );
}

export { XmrDisabledInfo, HardwareDisabledInfo };
