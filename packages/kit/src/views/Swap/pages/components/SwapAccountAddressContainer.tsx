import { useCallback, useMemo } from 'react';

import { ActionList, Button, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
}
const SwapAccountAddressContainer = ({
  type,
}: ISwapAccountAddressContainerProps) => {
  const swapAddressInfo = useSwapAddressInfo(type);
  const handleOnCreateAddress = useCallback(async () => {
    const { accountInfo } = swapAddressInfo;
    if (!accountInfo) return;
    await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
      walletId: accountInfo.wallet?.id,
      indexedAccountId: accountInfo.indexedAccount?.id,
      deriveType: accountInfo.deriveType,
      networkId: accountInfo.network?.id,
    });
  }, [swapAddressInfo]);
  const addressComponent = useMemo(() => {
    if (swapAddressInfo.address) {
      return <SizableText>{swapAddressInfo.address}</SizableText>;
    }
    if (!swapAddressInfo.accountInfo) {
      return <Button variant="tertiary">No Account</Button>;
    }
    const { accountInfo } = swapAddressInfo;
    const items: { label: string; onPress: () => void }[] = [
      {
        label: `Create ${accountInfo.network?.name ?? 'unknown'} address for ${
          accountInfo.wallet?.name ?? 'unknown'
        } - ${accountInfo.accountName}`,
        onPress: handleOnCreateAddress,
      },
      {
        label: 'Enter a recipient address',
        onPress: () => {},
      },
    ];
    return (
      <ActionList
        items={items}
        title="Add a address"
        renderTrigger={<Button variant="tertiary">No Address</Button>}
      />
    );
  }, [handleOnCreateAddress, swapAddressInfo]);
  return (
    <XStack>
      <SizableText mr="$2">
        {type === ESwapDirectionType.FROM ? 'From' : 'To'}
      </SizableText>
      {addressComponent}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
