import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Image,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
        {networkInfo ? (
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
            <Image w={16} h={16} source={{ uri: networkInfo.logoURI }} />
            <SizableText size="$bodyMd" color="$text">
              {networkInfo.name}
            </SizableText>
          </XStack>
        ) : null}
      </AnimatePresence>
    );
  }, [
    swapSupportAllNetwork,
    onClickNetwork,
    type,
    fromToken?.networkId,
    toToken?.networkId,
  ]);

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
      {type === ESwapDirectionType.FROM &&
      activeAccount.vaultSettings?.mergeDeriveAssetsEnabled &&
      !!fromToken ? (
        <AddressTypeSelector
          placement="bottom-start"
          networkId={fromToken.networkId}
          indexedAccountId={activeAccount.indexedAccount?.id ?? ''}
          walletId={activeAccount.wallet?.id ?? ''}
          activeDeriveType={activeAccount.deriveType}
          activeDeriveInfo={activeAccount.deriveInfo}
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
