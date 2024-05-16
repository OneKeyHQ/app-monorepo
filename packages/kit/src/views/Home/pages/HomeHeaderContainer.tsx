import { Portal, Stack } from '@onekeyhq/components';

import { UpdateReminder } from '../../../components/UpdateReminder';
import { HomeFirmwareUpdateReminder } from '../../FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import HomeSelector from '../components/HomeSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';

import { HomeOverviewContainer } from './HomeOverviewContainer';

function HomeHeaderContainer() {
  return (
    <HomeTokenListProviderMirror>
      <UpdateReminder />
      <HomeFirmwareUpdateReminder />
      <Stack testID="Wallet-Tab-Header" p="$5">
        <HomeSelector mb="$2.5" />
        <Stack
          $gtLg={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <HomeOverviewContainer />
          <Portal.Container name={Portal.Constant.WALLET_ACTIONS} />
        </Stack>
      </Stack>
    </HomeTokenListProviderMirror>
  );
}

export { HomeHeaderContainer };
