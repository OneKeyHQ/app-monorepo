/* eslint-disable @typescript-eslint/ban-types */

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, IconButton, Modal } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorChangeAccountOnPress } from '../../hooks/useAccountSelectorChangeAccountOnPress';
import { useAccountSelectorModalInfo } from '../../hooks/useAccountSelectorModalInfo';
import SideChainSelector from '../NetworkAccountSelectorModal/SideChainSelector';

import type { ManageNetworkRoutesParams } from '../../../../views/ManageNetworks/types';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkSelector
>;

function NetworkSelectorModal() {
  const intl = useIntl();
  const { onPressChangeAccount } = useAccountSelectorChangeAccountOnPress();
  const navigation = useAppNavigation();
  const route = useRoute<RouteProps>();

  const params = route?.params ?? {};

  const {
    networkImpl,
    onSelected,
    selectedNetworkId,
    selectableNetworks,
    sortDisabled,
    customDisabled,
    rpcStatusDisabled,
  } = params;

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
          {sortDisabled ? null : (
            <IconButton
              type="plain"
              size="lg"
              circle
              name="BarsArrowUpOutline"
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.ManageNetwork,
                  params: { screen: ManageNetworkModalRoutes.Sort },
                });
              }}
            />
          )}
          {customDisabled ? null : (
            <IconButton
              type="plain"
              size="lg"
              circle
              name="PlusCircleOutline"
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.ManageNetwork,
                  params: { screen: ManageNetworkModalRoutes.Listing },
                });
              }}
            />
          )}
        </>
      }
    >
      <LazyDisplayView delay={0}>
        <Box flex={1} flexDirection="row">
          <SideChainSelector
            networkImpl={networkImpl}
            fullWidthMode // should be fullWidthMode here
            rpcStatusDisabled={rpcStatusDisabled}
            accountSelectorInfo={accountSelectorInfo}
            selectedNetworkId={selectedNetworkId}
            selectableNetworks={selectableNetworks}
            onPress={async ({ networkId }) => {
              if (onSelected) {
                onSelected(networkId);
              } else {
                await onPressChangeAccount({
                  networkId,
                  accountSelectorMode: accountSelectorInfo.accountSelectorMode,
                });
              }
            }}
          />
        </Box>
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkSelectorModal };
