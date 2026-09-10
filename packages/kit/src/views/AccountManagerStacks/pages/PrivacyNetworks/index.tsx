import type { IPageScreenProps } from '@onekeyhq/components';
import PrivacyNetworkSettings from '@onekeyhq/kit/src/views/Setting/pages/PrivacyNetwork';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes/accountManagerStacks';

export default function PrivacyNetworks({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.PrivacyNetworks
>) {
  return <PrivacyNetworkSettings walletId={route.params.walletId} />;
}
