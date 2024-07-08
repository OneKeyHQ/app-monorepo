import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Spinner,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import {
  useSwapProviderSupportReceiveAddressAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useAccountManualCreatingAtom,
  useSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { useSwapAddressInfo } from '../../hooks/useSwapAccount';

function AddressButton({
  address,
  empty,
  edited,
  loading,
  onPress,
}: {
  address?: string;
  empty?: boolean;
  loading?: boolean;
  edited?: boolean;
} & IXStackProps) {
  const intl = useIntl();
  return (
    <XStack
      alignItems="center"
      space="$1"
      py="$0.5"
      px="$1.5"
      my="$-0.5"
      mx="$-1.5"
      borderRadius="$2"
      opacity={loading ? 0.5 : 1}
      disabled={!!loading}
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
          {empty
            ? intl.formatMessage({ id: ETranslations.wallet_no_address })
            : address}
        </SizableText>
        {edited ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.swap_account_to_address_edit,
            })}
          </SizableText>
        ) : null}
      </XStack>
      {loading ? <Spinner size="small" /> : null}
      {onPress && empty && !loading ? (
        <Icon
          name="PlusCircleOutline"
          size="$4.5"
          color="$iconSubdued"
          mr="$-0.5"
        />
      ) : null}
      {onPress && !empty && !loading ? (
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
  const [accountManualCreatingAtom, setAccountManualCreatingAtom] =
    useAccountManualCreatingAtom();

  const handleOnCreateAddress = useCallback(async () => {
    if (!swapAddressInfo.accountInfo) return;
    const networkId = swapAddressInfo.accountInfo.network?.id;
    const walletId = swapAddressInfo.accountInfo.wallet?.id;
    const indexedAccountId = swapAddressInfo.accountInfo.indexedAccount?.id;
    const deriveType = swapAddressInfo.accountInfo.deriveType;
    const account = {
      walletId,
      indexedAccountId,
      deriveType,
      networkId,
    };
    const key =
      networkId && walletId && (deriveType || indexedAccountId)
        ? [networkId, deriveType, walletId, indexedAccountId].join('-')
        : Math.random().toString();
    try {
      setAccountManualCreatingAtom((prev) => ({
        ...prev,
        key,
        isLoading: true,
      }));
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
    } finally {
      setAccountManualCreatingAtom((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [
    createAddress,
    intl,
    setAccountManualCreatingAtom,
    swapAddressInfo.accountInfo,
    type,
  ]);

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
      return (
        <AddressButton
          empty
          loading={accountManualCreatingAtom.isLoading}
          onPress={handleOnCreateAddress}
        />
      );
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
    accountManualCreatingAtom.isLoading,
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
