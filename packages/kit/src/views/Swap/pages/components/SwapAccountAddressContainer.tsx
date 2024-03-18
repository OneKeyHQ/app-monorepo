import { useCallback, useMemo } from 'react';

import type { IPageNavigationProp, IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/uswSwapAccount';

function AddressButton({
  address,
  empty,
  edited,
  onPress,
}: {
  address?: string;
  empty?: boolean;
  edited?: boolean;
} & IXStackProps) {
  return (
    <XStack
      alignItems="center"
      space="$1"
      py="$0.5"
      px="$1.5"
      my="$-0.5"
      mx="$-1.5"
      borderRadius="$2"
      onPress={onPress}
      {...(onPress && {
        role: 'button',
        userSelect: 'none',
        focusable: true,
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        focusStyle: {
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        },
        '$platform-native': {
          hitSlop: {
            top: 8,
            right: 8,
          },
        },
      })}
    >
      <XStack>
        <SizableText
          size="$bodyMd"
          color={empty ? '$textCaution' : '$textSubdued'}
        >
          {empty ? 'No Addreses' : address}
        </SizableText>
        {edited && (
          <SizableText size="$bodyMd" color="$textSubdued">
            (Edited)
          </SizableText>
        )}
      </XStack>
      {onPress && empty && (
        <Icon
          name="PlusCircleOutline"
          size="$4.5"
          color="$iconSubdued"
          mr="$-0.5"
        />
      )}
      {onPress && !empty && (
        <Icon
          name="PencilOutline"
          size="$4.5"
          color="$iconSubdued"
          mr="$-0.5"
        />
      )}
    </XStack>
  );
}

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
}
const SwapAccountAddressContainer = ({
  type,
}: ISwapAccountAddressContainerProps) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const swapAddressInfo = useSwapAddressInfo(type);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
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
    if (!fromToken && type === ESwapDirectionType.FROM) {
      return null;
    }
    if (!toToken && type === ESwapDirectionType.TO) {
      return null;
    }
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
      return <AddressButton empty onPress={handleOnCreateAddress} />;
    }
    if (type === ESwapDirectionType.FROM || !swapSupportReceiveAddress) {
      return (
        <AddressButton
          address={accountUtils.shortenAddress({
            address: swapAddressInfo.address ?? '',
          })}
        />
      );
    }
    return (
      <AddressButton
        onPress={() => {
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapToAnotherAddress,
            params: { address: swapAddressInfo.address },
          });
        }}
        address={accountUtils.shortenAddress({
          address: swapAddressInfo.address ?? '',
        })}
      />
    );
  }, [
    fromToken,
    handleOnCreateAddress,
    navigation,
    swapAddressInfo.accountInfo,
    swapAddressInfo.address,
    swapSupportReceiveAddress,
    toToken,
    type,
  ]);

  return (
    <XStack pb="$1.5">
      <SizableText size="$bodyMdMedium" mr="$2">
        {type === ESwapDirectionType.FROM ? 'From' : 'To'}
      </SizableText>
      {addressComponent}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
