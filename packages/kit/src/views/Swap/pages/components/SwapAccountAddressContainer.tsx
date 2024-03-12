import { useCallback, useMemo } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useSwapProviderSupportReceiveAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';
import { EModalSwapRoutes, type IModalSwapParamList } from '../../router/types';
import { getShortAddress } from '../../utils/utils';

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
}
const SwapAccountAddressContainer = ({
  type,
}: ISwapAccountAddressContainerProps) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const swapAddressInfo = useSwapAddressInfo(type);

  const [swapSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();

  const handleOnCreateAddress = useCallback(async () => {
    if (!swapAddressInfo.accountInfo) return;
    await backgroundApiProxy.serviceAccount.addHDOrHWAccounts({
      walletId: swapAddressInfo.accountInfo.wallet?.id,
      indexedAccountId: swapAddressInfo.accountInfo.indexedAccount?.id,
      deriveType: swapAddressInfo.accountInfo.deriveType,
      networkId: swapAddressInfo.accountInfo.network?.id,
    });
  }, [swapAddressInfo.accountInfo]);

  const addressComponent = useMemo(() => {
    if (!swapAddressInfo.accountInfo) {
      return <Button variant="tertiary">No Account</Button>;
    }
    if (!swapAddressInfo.address) {
      return (
        <Button onPress={handleOnCreateAddress} variant="tertiary">
          Create Address
        </Button>
      );
    }
    if (type === ESwapDirectionType.FROM || !swapSupportReceiveAddress) {
      return (
        <Button
          onPress={() => {
            // copy address
          }}
          variant="tertiary"
        >
          {getShortAddress(swapAddressInfo.address)}
        </Button>
      );
    }
    return (
      <Button
        onPress={() => {
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapToAnotherAddress,
            params: { address: swapAddressInfo.address },
          });
        }}
        variant="tertiary"
        iconAfter="PencilOutline"
      >
        {getShortAddress(swapAddressInfo.address)}
      </Button>
    );
  }, [
    handleOnCreateAddress,
    navigation,
    swapAddressInfo.accountInfo,
    swapAddressInfo.address,
    swapSupportReceiveAddress,
    type,
  ]);

  return (
    <XStack py="$2">
      <SizableText mr="$2">
        {type === ESwapDirectionType.FROM ? 'From' : 'To'}
      </SizableText>
      {addressComponent}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
