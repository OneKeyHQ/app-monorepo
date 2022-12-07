/* eslint-disable @typescript-eslint/ban-types */

import { useIntl } from 'react-intl';

import { Box, Modal } from '@onekeyhq/components';

import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorChangeAccountOnPress } from '../../hooks/useAccountSelectorChangeAccountOnPress';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';
import SideChainSelector from '../NetworkAccountSelectorModal/SideChainSelector';

function NetworkSelectorModal() {
  const intl = useIntl();
  const { onPressChangeAccount } = useAccountSelectorChangeAccountOnPress();

  const { accountSelectorInfo, shouldShowModal } =
    useAccountSelectorModalInfo();
  if (!shouldShowModal) {
    return null;
  }

  return (
    <Modal
      header={intl.formatMessage({ id: 'network__networks' })}
      headerDescription={accountSelectorInfo?.selectedNetwork?.name || '-'}
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
    >
      <LazyDisplayView delay={0}>
        <Box flex={1} flexDirection="row">
          <SideChainSelector
            fullWidthMode // should be fullWidthMode here
            accountSelectorInfo={accountSelectorInfo}
            onPress={async ({ networkId }) => {
              await onPressChangeAccount({
                networkId,
                accountSelectorMode: accountSelectorInfo.accountSelectorMode,
              });
            }}
          />
        </Box>
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkSelectorModal };
