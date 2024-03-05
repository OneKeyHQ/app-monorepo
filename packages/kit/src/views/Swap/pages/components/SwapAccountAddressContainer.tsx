import { useMemo } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Button, SizableText, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';
import { EModalSwapRoutes, type IModalSwapParamList } from '../../router/types';

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
}
const SwapAccountAddressContainer = ({
  type,
}: ISwapAccountAddressContainerProps) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const swapAddressInfo = useSwapAddressInfo(type);

  const addressComponent = useMemo(() => {
    if (swapAddressInfo.address) {
      return <SizableText>{swapAddressInfo.address}</SizableText>;
    }
    if (!swapAddressInfo.accountInfo) {
      return <Button variant="tertiary">No Account</Button>;
    }
    return (
      <Button
        onPress={() => {
          navigation.push(EModalSwapRoutes.SwapToAnotherAddress);
        }}
        variant="tertiary"
      >
        No Address
      </Button>
    );
  }, [navigation, swapAddressInfo]);

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
