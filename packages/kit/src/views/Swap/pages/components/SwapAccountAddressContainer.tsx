import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Image, SizableText, XStack } from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

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
  const [swapSupportAllNetwork] = useSwapNetworksIncludeAllNetworkAtom();
  const [toToken] = useSwapSelectToTokenAtom();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const { activeAccount: activeToAccount } = useActiveAccount({ num: 1 });
  const networkComponent = useMemo(() => {
    const token = type === ESwapDirectionType.FROM ? fromToken : toToken;
    const networkInfo = swapSupportAllNetwork.find(
      (net) => net.networkId === token?.networkId,
    );
    const localNetworkInfo = token?.networkId
      ? networkUtils.getLocalNetworkInfo(token.networkId)
      : undefined;
    const networkName = networkInfo?.name ?? localNetworkInfo?.name;
    const networkLogoURI =
      networkInfo?.logoURI ??
      token?.networkLogoURI ??
      localNetworkInfo?.logoURI;

    return networkName ? (
      <XStack
        key="network-component"
        gap="$1"
        alignItems="center"
        cursor="pointer"
        onPress={() => {
          onClickNetwork?.(type);
        }}
      >
        {networkLogoURI ? (
          <Image w={16} h={16} source={{ uri: networkLogoURI }} />
        ) : null}
        <SizableText size="$bodyMd" color="$text">
          {networkName}
        </SizableText>
      </XStack>
    ) : null;
  }, [swapSupportAllNetwork, onClickNetwork, type, fromToken, toToken]);

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText
        size="$bodyMd"
        mr="$1"
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
      {(type === ESwapDirectionType.FROM &&
        activeAccount.vaultSettings?.mergeDeriveAssetsEnabled &&
        !!fromToken) ||
      (type === ESwapDirectionType.TO &&
        activeToAccount.vaultSettings?.mergeDeriveAssetsEnabled &&
        !!toToken) ? (
        <AddressTypeSelector
          refreshOnOpen
          placement="bottom-start"
          networkId={
            type === ESwapDirectionType.FROM
              ? (fromToken?.networkId ?? '')
              : (toToken?.networkId ?? '')
          }
          indexedAccountId={
            type === ESwapDirectionType.FROM
              ? (activeAccount.indexedAccount?.id ?? '')
              : (activeToAccount.indexedAccount?.id ?? '')
          }
          walletId={
            type === ESwapDirectionType.FROM
              ? (activeAccount.wallet?.id ?? '')
              : (activeToAccount.wallet?.id ?? '')
          }
          activeDeriveType={
            type === ESwapDirectionType.FROM
              ? activeAccount.deriveType
              : activeToAccount.deriveType
          }
          activeDeriveInfo={
            type === ESwapDirectionType.FROM
              ? activeAccount.deriveInfo
              : activeToAccount.deriveInfo
          }
          renderSelectorTrigger={
            <DeriveTypeSelectorTriggerIconRenderer
              autoShowLabel={false}
              onPress={() => {}}
              iconProps={{
                size: '$4',
              }}
              labelProps={{
                pl: '$1',
              }}
            />
          }
        />
      ) : null}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
