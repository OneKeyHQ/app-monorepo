import { Badge, XStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

type IProps = {
  accountId?: string;
  networkId: string;
  address: string;
};

function AddressInfo(props: IProps) {
  const { accountId, networkId, address } = props;
  const addressQueryResult = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccountProfile.queryAddress({
        accountId,
        networkId,
        address,
        enableAddressBook: true,
        enableWalletName: true,
        skipValidateAddress: true,
      }),
    [accountId, address, networkId],
  ).result;

  if (!addressQueryResult) {
    return null;
  }

  if (
    !addressQueryResult.walletAccountName &&
    !addressQueryResult.addressBookName
  )
    return null;

  return (
    <XStack gap="$2" flex={1} flexWrap="wrap">
      {addressQueryResult.walletAccountName ? (
        <Badge badgeType="success" badgeSize="sm">
          {addressQueryResult.walletAccountName}
        </Badge>
      ) : null}
      {addressQueryResult.addressBookName ? (
        <Badge badgeType="success" badgeSize="sm">
          {addressQueryResult.addressBookName}
        </Badge>
      ) : null}
    </XStack>
  );
}

export { AddressInfo };
