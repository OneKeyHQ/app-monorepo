import { useCallback, useMemo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';

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
  onToAnotherAddressModal?: () => void;
}
const SwapAccountAddressContainer = ({
  type,
  onToAnotherAddressModal,
}: ISwapAccountAddressContainerProps) => {
  const swapAddressInfo = useSwapAddressInfo(type);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();

  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();

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
      !swapAddressInfo.accountInfo.indexedAccount ||
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
        onPress={onToAnotherAddressModal}
        address={`${accountUtils.shortenAddress({
          address: swapAddressInfo.address ?? '',
        })} ${swapToAnotherAccountSwitchOn ? '(Edited)' : ''}`}
      />
    );
  }, [
    fromToken,
    handleOnCreateAddress,
    onToAnotherAddressModal,
    swapAddressInfo.accountInfo?.indexedAccount,
    swapAddressInfo.accountInfo?.wallet,
    swapAddressInfo.address,
    swapSupportReceiveAddress,
    swapToAnotherAccountSwitchOn,
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
