import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, Typography } from '@onekeyhq/components';

import { useCopyAddress } from '../../../hooks/useCopyAddress';

import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.AllNetworksShowAccountFullAddress
>;

function AllNetworksShowAccountFullAddress() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();

  const { account, wallet, network } = route?.params ?? {};

  const { copyAddress } = useCopyAddress({
    wallet,
    account,
    network,
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'content__info' })}
      height="560px"
      hidePrimaryAction
      hideSecondaryAction={false}
      secondaryActionTranslationId="action__copy"
      onSecondaryActionPress={() =>
        copyAddress({
          address: account.address,
          displayAddress: account.displayAddress,
        })
      }
    >
      <Typography.Display2XLarge>{account.address}</Typography.Display2XLarge>
    </Modal>
  );
}

export { AllNetworksShowAccountFullAddress };
