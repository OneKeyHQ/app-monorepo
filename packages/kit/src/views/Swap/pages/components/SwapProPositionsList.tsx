import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  ListView,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
  useSwapSelectToTokenAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
  onSearchClick?: () => void;
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const { finallyTokenList } = useSwapProPositionsListFilter();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const [swapToToken] = useSwapSelectToTokenAtom();

  if (swapProSupportNetworksTokenListLoading) {
    return (
      <YStack gap="$2" p="$2">
        <XStack>
          <Skeleton w="$20" h="$8" radius="round" />
        </XStack>
        <XStack justifyContent="space-between">
          <Skeleton w="$20" h="$5" radius="round" />
          <Skeleton w="$10" h="$5" radius="round" />
        </XStack>
      </YStack>
    );
  }
  return (
    <YStack>
      {finallyTokenList.length > 0 ? (
        finallyTokenList.map((item, index) => (
          <>
            <SwapProPositionItem
              key={item.contractAddress}
              token={item}
              onPress={onTokenPress}
              disabled={Boolean(
                !focusSwapPro &&
                  equalTokenNoCaseSensitive({
                    token1: item,
                    token2: swapToToken,
                  }),
              )}
            />
            {index < finallyTokenList.length - 1 ? <Divider /> : null}
          </>
        ))
      ) : (
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      )}
      {SwapProCurrentSymbolEnable || !onSearchClick ? undefined : (
        <SwapProPositionListFooter onSearchClick={onSearchClick} />
      )}
    </YStack>
  );
};

export default SwapProPositionsList;
