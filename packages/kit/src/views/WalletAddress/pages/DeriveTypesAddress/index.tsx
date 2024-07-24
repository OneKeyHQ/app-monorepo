import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import type {
  EModalWalletAddressRoutes,
  IModalWalletAddressParamList,
} from '@onekeyhq/shared/src/routes';

const DeriveTypesAddress = () => (
  <Page>
    <Page.Header title="Derive Types" />
  </Page>
);

export default function WalletAddressPage({
  route,
}: IPageScreenProps<
  IModalWalletAddressParamList,
  EModalWalletAddressRoutes.DeriveTypesAddress
>) {
  const { accountId, indexedAccountId, walletId } = route.params;
  return <DeriveTypesAddress />;
}
