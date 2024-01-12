import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  Toast,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EChainSelectorPages } from '../../ChainSelector/router/type';
import { POLLING_INTERVAL_FOR_TOTAL_VALUE } from '../constants';

import { WalletActionsContainer } from './WalletActionsContainer';

import type { ITabHomeParamList } from '../router/types';

function HomeHeaderContainer() {
  const intl = useIntl();
  const navigation = useAppNavigation<IPageNavigationProp<ITabHomeParamList>>();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [settings] = useSettingsPersistAtom();

  const overview = usePromiseResult(async () => {
    if (!account || !network) return;
    const r = await backgroundApiProxy.serviceAddress.fetchAddressDetails({
      networkId: network.id,
      accountAddress: account.address,
      withNetWorth: true,
    });
    return r;
  }, [account, network]).result;

  const totalValue = useMemo(
    () =>
      `${settings.currencyInfo.symbol}${intl.formatNumber(
        new BigNumber(overview?.netWorth ?? 0).toNumber(),
      )}`,
    [intl, overview?.netWorth, settings.currencyInfo.symbol],
  );

  const handleChainPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.Selector,
    });
  }, [navigation]);

  return (
    <Stack
      p="$5"
      $gtMd={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Stack>
        <XStack mb="$1">
          <XStack
            alignItems="center"
            onPress={handleChainPress}
            p="$1"
            m="$-1"
            borderRadius="$2"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusable
            focusStyle={{
              outlineWidth: 2,
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
            }}
            $platform-native={{
              hitSlop: {
                top: 8,
                bottom: 8,
                left: 8,
              },
            }}
          >
            <Image
              w="$5"
              h="$5"
              source={{
                uri: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
              }}
            />
            <SizableText
              userSelect="none"
              pl="$2"
              size="$bodyMd"
              color="$textSubdued"
            >
              Bitcoin
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              color="$iconSubdued"
              size="$5"
            />
          </XStack>
          <Tooltip
            renderContent="Copy to clipboard"
            placement="top"
            renderTrigger={
              <XStack
                alignItems="center"
                onPress={() =>
                  Toast.success({
                    title: 'Copied',
                  })
                }
                p="$1"
                px="$2"
                my="$-1"
                ml="$1"
                borderRadius="$2"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                focusable
                focusStyle={{
                  outlineWidth: 2,
                  outlineColor: '$focusRing',
                  outlineStyle: 'solid',
                }}
                $platform-native={{
                  hitSlop: {
                    top: 8,
                    right: 8,
                    bottom: 8,
                  },
                }}
              >
                <SizableText
                  userSelect="none"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  37rdQk...PCTG
                </SizableText>
              </XStack>
            }
          />
        </XStack>

        <Stack mt="$1">
          <SizableText
            size="$heading4xl"
            $gtMd={{
              size: '$heading5xl',
            }}
          >
            {totalValue}
          </SizableText>
        </Stack>
      </Stack>
      <WalletActionsContainer />
    </Stack>
  );
}

export { HomeHeaderContainer };
