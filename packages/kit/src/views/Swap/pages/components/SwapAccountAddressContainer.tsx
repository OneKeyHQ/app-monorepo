import { useCallback, useMemo } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapProviderSupportReceiveAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';
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
    if (
      !swapAddressInfo.accountInfo ||
      swapAddressInfo.accountInfo.wallet?.type === WALLET_TYPE_WATCHING ||
      (swapAddressInfo.accountInfo.wallet?.type === WALLET_TYPE_IMPORTED &&
        !swapAddressInfo.address)
    ) {
      return null;
    }
    if (
      !swapAddressInfo.address &&
      (swapAddressInfo.accountInfo.wallet?.type === WALLET_TYPE_HD ||
        swapAddressInfo.accountInfo.wallet?.type === WALLET_TYPE_HW)
    ) {
      return (
        <Button
          iconAfter="PlusCircleOutline"
          onPress={handleOnCreateAddress}
          variant="tertiary"
        >
          No Address
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
          {getShortAddress(swapAddressInfo.address ?? '')}
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
        {getShortAddress(swapAddressInfo.address ?? '')}
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
