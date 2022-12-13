/* eslint-disable @typescript-eslint/ban-types */

import { useIntl } from 'react-intl';

import { Box, IconButton, Modal } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { ManageNetworkRoutes } from '../../../../views/ManageNetworks/types';
import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorChangeAccountOnPress } from '../../hooks/useAccountSelectorChangeAccountOnPress';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';
import SideChainSelector from '../NetworkAccountSelectorModal/SideChainSelector';

function NetworkSelectorModal() {
  const intl = useIntl();
  const { onPressChangeAccount } = useAccountSelectorChangeAccountOnPress();
  const navigation = useAppNavigation();

  const { accountSelectorInfo, shouldShowModal } =
    useAccountSelectorModalInfo();
  if (!shouldShowModal) {
    return null;
  }

  return (
    <Modal
      header={intl.formatMessage({ id: 'network__networks' })}
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
      rightContent={
        <>
          <IconButton
            type="plain"
            size="lg"
            circle
            name="BarsArrowUpOutline"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageNetwork,
                params: { screen: ManageNetworkRoutes.Sort },
              });
            }}
          />
          <IconButton
            type="plain"
            size="lg"
            circle
            name="PlusCircleOutline"
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.ManageNetwork,
                params: { screen: ManageNetworkRoutes.Listing },
              });
            }}
          />
        </>
      }
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
