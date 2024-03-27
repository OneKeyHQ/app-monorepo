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
import { useSwapToAnotherAccountSwitchOnAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
        {edited ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            (Edited)
          </SizableText>
        ) : null}
      </XStack>
      {onPress && empty ? (
        <Icon
          name="PlusCircleOutline"
          size="$4.5"
          color="$iconSubdued"
          mr="$-0.5"
        />
      ) : null}
      {onPress && !empty ? (
        <Icon
          name="PencilOutline"
          size="$4.5"
          color="$iconSubdued"
          mr="$-0.5"
        />
      ) : null}
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

  const [swapToAnotherAddressSwitch] = useSwapToAnotherAccountSwitchOnAtom();

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
      !swapAddressInfo.accountInfo?.wallet ||
      (type === ESwapDirectionType.FROM &&
        !swapAddressInfo.address &&
        !accountUtils.isHdWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        }) &&
        !accountUtils.isHwWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        }))
    ) {
      return null;
    }
    if (
      !swapAddressInfo.address &&
      (accountUtils.isHdWallet({
        walletId: swapAddressInfo.accountInfo?.wallet?.id,
      }) ||
        accountUtils.isHwWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        }))
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
    // to address
    return (
      <AddressButton
        onPress={() => {
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapToAnotherAddress,
            params: { address: swapAddressInfo.address },
          });
        }}
        address={`${accountUtils.shortenAddress({
          address: swapAddressInfo.address ?? '',
        })} ${swapToAnotherAddressSwitch ? '(Edited)' : ''}`}
      />
    );
  }, [
    fromToken,
    handleOnCreateAddress,
    navigation,
    swapAddressInfo.accountInfo,
    swapAddressInfo.address,
    swapSupportReceiveAddress,
    swapToAnotherAddressSwitch,
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
