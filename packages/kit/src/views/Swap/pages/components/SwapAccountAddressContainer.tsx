import { useMemo } from 'react';

import { useIntl } from 'react-intl';

// import type { IXStackProps } from '@onekeyhq/components';
import {
  AnimatePresence,
  // Icon,
  Image,
  SizableText,
  // Spinner,
  // Toast,
  XStack,
} from '@onekeyhq/components';
// import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import {
  useSwapNetworksIncludeAllNetworkAtom,
  // useSwapProviderSupportReceiveAddressAtom,
  // useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
// import {
//   useAccountManualCreatingAtom,
//   useSettingsAtom,
// } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
// import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
// import platformEnv from '@onekeyhq/shared/src/platformEnv';
// import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

// import { useSwapAddressInfo } from '../../hooks/useSwapAccount';

// const hitSlop = platformEnv.isNative
//   ? {
//       top: 8,
//       right: 8,
//     }
//   : undefined;
// function AddressButton({
//   address,
//   empty,
//   edited,
//   loading,
//   onPress,
// }: {
//   address?: string;
//   empty?: boolean;
//   loading?: boolean;
//   edited?: boolean;
// } & IXStackProps) {
//   const intl = useIntl();
//   return (
//     <XStack
//       alignItems="center"
//       gap="$1"
//       py="$0.5"
//       px="$1.5"
//       my="$-0.5"
//       mx="$-1.5"
//       borderRadius="$2"
//       opacity={loading ? 0.5 : 1}
//       disabled={!!loading}
//       onPress={onPress}
//       hitSlop={hitSlop}
//       {...(onPress && {
//         role: 'button',
//         userSelect: 'none',
//         focusable: true,
//         hoverStyle: { bg: '$bgHover' },
//         pressStyle: { bg: '$bgActive' },
//         focusVisibleStyle: {
//           outlineWidth: 2,
//           outlineColor: '$focusRing',
//           outlineStyle: 'solid',
//         },
//       })}
//     >
//       <XStack>
//         <SizableText
//           size="$bodyMd"
//           color={empty ? '$textCaution' : '$textSubdued'}
//         >
//           {empty
//             ? intl.formatMessage({ id: ETranslations.swap_page_no_address })
//             : address}
//         </SizableText>
//         {edited ? (
//           <SizableText size="$bodyMd" color="$textSubdued">
//             {intl.formatMessage({
//               id: ETranslations.swap_account_to_address_edit,
//             })}
//           </SizableText>
//         ) : null}
//       </XStack>
//       {loading ? <Spinner size="small" /> : null}
//       {onPress && empty && !loading ? (
//         <Icon
//           name="PlusCircleOutline"
//           size="$4.5"
//           color="$iconSubdued"
//           mr="$-0.5"
//         />
//       ) : null}
//       {onPress && !empty && !loading ? (
//         <Icon
//           name="PencilOutline"
//           size="$4.5"
//           color="$iconSubdued"
//           mr="$-0.5"
//         />
//       ) : null}
//     </XStack>
//   );
// }

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
  onClickNetwork?: (type: ESwapDirectionType) => void;
}
const SwapAccountAddressContainer = ({
  type,
  onClickNetwork,
}: ISwapAccountAddressContainerProps) => {
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapSupportAllNetwork] = useSwapNetworksIncludeAllNetworkAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  // const [quoteResult] = useSwapQuoteCurrentSelectAtom();
  // const [swapSupportReceiveAddress] =
  //   useSwapProviderSupportReceiveAddressAtom();
  // const { createAddress } = useAccountSelectorCreateAddress();

  // const [{ swapToAnotherAccountSwitchOn }] = useSettingsAtom();
  // const [accountManualCreatingAtom, setAccountManualCreatingAtom] =
  //   useAccountManualCreatingAtom();

  // const handleOnCreateAddress = useCallback(async () => {
  //   if (!swapAddressInfo.accountInfo) return;
  //   const networkId = swapAddressInfo.accountInfo.network?.id;
  //   const walletId = swapAddressInfo.accountInfo.wallet?.id;
  //   const indexedAccountId = swapAddressInfo.accountInfo.indexedAccount?.id;
  //   const deriveType = swapAddressInfo.accountInfo.deriveType;
  //   const account = {
  //     walletId,
  //     indexedAccountId,
  //     deriveType,
  //     networkId,
  //   };
  //   const key =
  //     networkId && walletId && (deriveType || indexedAccountId)
  //       ? [networkId, deriveType, walletId, indexedAccountId].join('-')
  //       : Math.random().toString();
  //   try {
  //     setAccountManualCreatingAtom((prev) => ({
  //       ...prev,
  //       key,
  //       isLoading: true,
  //     }));
  //     await createAddress({
  //       num: type === ESwapDirectionType.FROM ? 0 : 1,
  //       account,
  //       selectAfterCreate: false,
  //     });
  //     Toast.success({
  //       title: intl.formatMessage({
  //         id: ETranslations.swap_page_toast_address_generated,
  //       }),
  //     });
  //   } catch (e) {
  //     Toast.error({
  //       title: intl.formatMessage({
  //         id: ETranslations.swap_page_toast_address_generated_fail,
  //       }),
  //     });
  //   } finally {
  //     setAccountManualCreatingAtom((prev) => ({
  //       ...prev,
  //       isLoading: false,
  //     }));
  //   }
  // }, [
  //   createAddress,
  //   intl,
  //   setAccountManualCreatingAtom,
  //   swapAddressInfo.accountInfo,
  //   type,
  // ]);

  // const addressComponent = useMemo(() => {
  //   if (!fromToken && type === ESwapDirectionType.FROM) {
  //     return null;
  //   }
  //   if (!toToken && type === ESwapDirectionType.TO) {
  //     return null;
  //   }
  //   if (
  //     type === ESwapDirectionType.FROM &&
  //     (!swapAddressInfo.accountInfo?.wallet ||
  //       ((accountUtils.isHdWallet({
  //         walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //       }) ||
  //         accountUtils.isHwWallet({
  //           walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //         }) ||
  //         accountUtils.isQrWallet({
  //           walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //         })) &&
  //         !swapAddressInfo.accountInfo?.indexedAccount) ||
  //       (!swapAddressInfo.address &&
  //         !accountUtils.isHdWallet({
  //           walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //         }) &&
  //         !accountUtils.isHwWallet({
  //           walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //         })))
  //   ) {
  //     return null;
  //   }
  //   // address same need hidden
  //   if (
  //     ((fromToken && type === ESwapDirectionType.FROM) ||
  //       (toToken && type === ESwapDirectionType.TO)) &&
  //     swapAddressInfo.address &&
  //     swapAnotherAddressInfo.address &&
  //     swapAddressInfo.address === swapAnotherAddressInfo.address
  //   ) {
  //     return null;
  //   }
  //   // all net need hidden
  //   if (
  //     swapAddressInfo.accountInfo?.network?.id ===
  //       getNetworkIdsMap().onekeyall ||
  //     swapAnotherAddressInfo.accountInfo?.network?.id ===
  //       getNetworkIdsMap().onekeyall
  //   ) {
  //     return null;
  //   }
  //   if (
  //     fromToken &&
  //     (!toToken || (toToken && !swapAnotherAddressInfo.address)) &&
  //     type === ESwapDirectionType.FROM &&
  //     swapAddressInfo.address
  //   ) {
  //     return null;
  //   }
  //   if (
  //     !swapAddressInfo.address &&
  //     (accountUtils.isHdWallet({
  //       walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //     }) ||
  //       accountUtils.isHwWallet({
  //         walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //       }) ||
  //       accountUtils.isQrWallet({
  //         walletId: swapAddressInfo.accountInfo?.wallet?.id,
  //       }))
  //   ) {
  //     return (
  //       <AddressButton
  //         empty
  //         loading={accountManualCreatingAtom.isLoading}
  //         onPress={handleOnCreateAddress}
  //       />
  //     );
  //   }
  //   if (
  //     type === ESwapDirectionType.FROM ||
  //     !swapSupportReceiveAddress ||
  //     !quoteResult
  //   ) {
  //     return (
  //       <AddressButton
  //         address={accountUtils.shortenAddress({
  //           address: swapAddressInfo.address ?? '',
  //           leadingLength: 8,
  //         })}
  //       />
  //     );
  //   }
  //   // to address
  //   return (
  //     <AddressButton
  //       onPress={onToAnotherAddressModal}
  //       address={
  //         swapToAnotherAccountSwitchOn && swapAddressInfo.address
  //           ? `${accountUtils.shortenAddress({
  //               address: swapAddressInfo.address ?? '',
  //               leadingLength: 8,
  //             })} ${intl.formatMessage({
  //               id: ETranslations.swap_account_to_address_edit,
  //             })}`
  //           : accountUtils.shortenAddress({
  //               address: swapAddressInfo.address ?? '',
  //               leadingLength: 8,
  //             })
  //       }
  //     />
  //   );
  // }, [
  //   fromToken,
  //   type,
  //   toToken,
  //   swapAddressInfo.accountInfo?.wallet,
  //   swapAddressInfo.accountInfo?.indexedAccount,
  //   swapAddressInfo.accountInfo?.network?.id,
  //   swapAddressInfo.address,
  //   swapAnotherAddressInfo.address,
  //   swapAnotherAddressInfo.accountInfo?.network?.id,
  //   swapSupportReceiveAddress,
  //   quoteResult,
  //   onToAnotherAddressModal,
  //   swapToAnotherAccountSwitchOn,
  //   intl,
  //   accountManualCreatingAtom.isLoading,
  //   handleOnCreateAddress,
  // ]);

  const networkComponent = useMemo(() => {
    const networkInfo = swapSupportAllNetwork.find(
      (net) =>
        net.networkId ===
        (type === ESwapDirectionType.FROM
          ? fromToken?.networkId
          : toToken?.networkId),
    );

    return (
      <AnimatePresence>
        {swapTypeSwitch === ESwapTabSwitchType.BRIDGE && networkInfo ? (
          <XStack
            key="network-component"
            animation="quick"
            enterStyle={{
              opacity: 0,
              x: 8,
            }}
            exitStyle={{
              opacity: 0,
              x: 4,
            }}
            gap="$1"
            alignItems="center"
            cursor="pointer"
            onPress={() => {
              onClickNetwork?.(type);
            }}
          >
            <Image w={18} h={18} source={{ uri: networkInfo.logoURI }} />
            <SizableText size="$bodyMd" color="$text">
              {networkInfo.name}
            </SizableText>
          </XStack>
        ) : null}
      </AnimatePresence>
    );
  }, [
    swapSupportAllNetwork,
    swapTypeSwitch,
    onClickNetwork,
    type,
    fromToken?.networkId,
    toToken?.networkId,
  ]);

  return (
    <XStack pb="$2">
      <SizableText
        size="$bodyMd"
        mr="$2"
        userSelect="none"
        color="$textSubdued"
      >
        {intl.formatMessage({
          id:
            type === ESwapDirectionType.FROM
              ? ETranslations.swap_page_from
              : ETranslations.swap_page_to,
        })}
      </SizableText>
      {networkComponent}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
