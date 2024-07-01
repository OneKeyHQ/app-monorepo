import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import { Icon, SizableText, Toast, XStack } from '@onekeyhq/components';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  const swapAddressInfo = useSwapAddressInfo(type);
  const swapAnotherAddressInfo = useSwapAddressInfo(
    type === ESwapDirectionType.FROM
      ? ESwapDirectionType.TO
      : ESwapDirectionType.FROM,
  );
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapSupportReceiveAddress] =
    useSwapProviderSupportReceiveAddressAtom();
  const { createAddress } = useAccountSelectorCreateAddress();

  const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();

  const handleOnCreateAddress = useCallback(async () => {
    if (!swapAddressInfo.accountInfo) return;
    const account = {
      walletId: swapAddressInfo.accountInfo.wallet?.id,
      indexedAccountId: swapAddressInfo.accountInfo.indexedAccount?.id,
      deriveType: swapAddressInfo.accountInfo.deriveType,
      networkId: swapAddressInfo.accountInfo.network?.id,
    };
    try {
      await createAddress({
        num: type === ESwapDirectionType.FROM ? 0 : 1,
        account,
        selectAfterCreate: false,
      });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_address_generated,
        }),
      });
    } catch (e) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_address_generated_fail,
        }),
      });
    }
  }, [createAddress, intl, swapAddressInfo.accountInfo, type]);

  const addressComponent = useMemo(() => {
    if (!fromToken && type === ESwapDirectionType.FROM) {
      return null;
    }
    if (!toToken && type === ESwapDirectionType.TO) {
      return null;
    }
    if (
      !swapAddressInfo.accountInfo?.wallet ||
      ((accountUtils.isHdWallet({
        walletId: swapAddressInfo.accountInfo?.wallet?.id,
      }) ||
        accountUtils.isHwWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        }) ||
        accountUtils.isQrWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        })) &&
        !swapAddressInfo.accountInfo?.indexedAccount) ||
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
    // address same need hidden
    if (
      ((fromToken && type === ESwapDirectionType.FROM) ||
        (toToken && type === ESwapDirectionType.TO)) &&
      swapAddressInfo.address &&
      swapAnotherAddressInfo.address &&
      swapAddressInfo.address === swapAnotherAddressInfo.address
    ) {
      return null;
    }
    if (
      fromToken &&
      !toToken &&
      type === ESwapDirectionType.FROM &&
      swapAddressInfo.address
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
        }) ||
        accountUtils.isQrWallet({
          walletId: swapAddressInfo.accountInfo?.wallet?.id,
        }))
    ) {
      return <AddressButton empty onPress={handleOnCreateAddress} />;
    }
    if (
      type === ESwapDirectionType.FROM ||
      !swapSupportReceiveAddress ||
      !quoteResult
    ) {
      return (
        <AddressButton
          address={accountUtils.shortenAddress({
            address: swapAddressInfo.address ?? '',
            leadingLength: 8,
          })}
        />
      );
    }
    // to address
    return (
      <AddressButton
        onPress={onToAnotherAddressModal}
        address={
          swapToAnotherAccountSwitchOn
            ? `${accountUtils.shortenAddress({
                address: swapAddressInfo.address ?? '',
                leadingLength: 8,
              })} ${intl.formatMessage({
                id: ETranslations.swap_account_to_address_edit,
              })}`
            : accountUtils.shortenAddress({
                address: swapAddressInfo.address ?? '',
                leadingLength: 8,
              })
        }
      />
    );
  }, [
    fromToken,
    type,
    toToken,
    swapAddressInfo,
    swapAnotherAddressInfo.address,
    swapSupportReceiveAddress,
    quoteResult,
    onToAnotherAddressModal,
    swapToAnotherAccountSwitchOn,
    intl,
    handleOnCreateAddress,
  ]);

  return (
    <XStack pb="$1.5">
      <SizableText size="$bodyMdMedium" mr="$2" userSelect="none">
        {intl.formatMessage({
          id:
            type === ESwapDirectionType.FROM
              ? ETranslations.swap_page_from
              : ETranslations.swap_page_to,
        })}
      </SizableText>
      {addressComponent}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
