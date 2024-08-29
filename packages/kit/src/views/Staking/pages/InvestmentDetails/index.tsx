import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SectionList,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import {
  EJotaiContextStoreNames,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAvailableAsset } from '@onekeyhq/shared/types/staking';

import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';

function BasicInvestmentDetails() {
  const [{ accounts }] = useEarnAtom();
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ListItem
        drillIn
        mx={0}
        px="$5"
        onPress={() => {}}
        avatarProps={{
          src: 'https://uni.onekey-asset.com/static/chain/sbtc.png',
        }}
        renderItemText={
          <XStack justifyContent="space-between" flex={1}>
            <YStack>
              <SizableText size="$bodyLgMedium">0.1 ETH</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                $333.13
              </SizableText>
            </YStack>
            <XStack>
              <Badge
                badgeType="critical"
                badgeSize="sm"
                userSelect="none"
                my="auto"
              >
                <Badge.Text>Hot</Badge.Text>
              </Badge>
            </XStack>
          </XStack>
        }
      />
    ),
    [],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Investment details" />
      <Page.Body>
        <SectionList
          ListEmptyComponent={
            <YStack flex={1} alignItems="center">
              <Icon size="$16" mt="$5" name="ClockTimeHistoryOutline" />
              <SizableText mt="$6" size="$headingXl">
                No orders
              </SizableText>
              <SizableText mt="$2" size="$bodyLg" color="$textSubdued">
                You haven’t staked any assets yet.
              </SizableText>
            </YStack>
          }
          renderItem={renderItem}
          sections={[]}
          py="$3"
          renderSectionHeader={({ section: { title, iconUrl }, index }) => (
            <XStack px="$5" gap="$1.5" pt={index !== 0 ? '$8' : undefined}>
              <Image height="$5" width="$5" borderRadius="$1">
                <Image.Source
                  source={{
                    uri: iconUrl,
                  }}
                />
                <Image.Fallback
                  alignItems="center"
                  justifyContent="center"
                  bg="$bgStrong"
                  delayMs={1000}
                >
                  <Icon size="$5" name="CoinOutline" color="$iconDisabled" />
                </Image.Fallback>
              </Image>
              <SizableText color="$textSubdued" size="$bodyMdMedium">
                {title}
              </SizableText>
            </XStack>
          )}
          estimatedItemSize={60}
        />
      </Page.Body>
    </Page>
  );
}

export default function InvestmentDetails() {
  return (
    <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
      <BasicInvestmentDetails />
    </EarnProviderMirror>
  );
}
