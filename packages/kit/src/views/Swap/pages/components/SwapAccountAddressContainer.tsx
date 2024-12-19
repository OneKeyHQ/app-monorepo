import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Image,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerForSwap } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import {
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

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
    <XStack pb="$2" alignItems="center" gap="$1">
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
      {type === ESwapDirectionType.FROM && !!fromToken ? (
        <DeriveTypeSelectorTriggerForSwap num={0} />
      ) : null}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
