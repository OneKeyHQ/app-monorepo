import {
  Badge,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAvailableAsset } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../components/AccountSelector';
import { ListItem } from '../../components/ListItem';
import { TabPageHeader } from '../../components/TabPageHeader';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

function Overview({
  assets,
  indexedAccountId,
}: {
  assets: IAvailableAsset[];
  indexedAccountId: string;
}) {
  const { result } = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceStaking.getAllNetworkAccount({
        assets,
        indexedAccountId,
      });
      return r;
    },
    [indexedAccountId, assets],
    {
      initResult: {},
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );
  console.log('result---', result);
  return (
    <YStack
      gap="$1"
      px="$5"
      borderRadius="$3"
      userSelect="none"
      {...listItemPressStyle}
    >
      <XStack justifyContent="space-between">
        <SizableText size="$bodyLg">Total staked value</SizableText>
        <XStack>
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            Details
          </SizableText>
          <Icon name="ChevronRightSmallSolid" color="$textSubdued" />
        </XStack>
      </XStack>
      <NumberSizeableText
        size="$heading5xl"
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        0
      </NumberSizeableText>
      <XStack gap="$1.5">
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="price"
          formatterOptions={{ currency: '$', showPlusMinusSigns: !!0 }}
          color={0 ? '$textInteractive' : '$textDisabled'}
        >
          0
        </NumberSizeableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          24h earnings
        </SizableText>
      </XStack>
    </YStack>
  );
}

function AvailableAssets({ assets }: { assets: IAvailableAsset[] }) {
  return (
    <YStack gap="$2" userSelect="none">
      <SizableText px="$5" size="$headingLg">
        Available assets
      </SizableText>
      {assets.map(({ name, logoURI, apr }) => (
        <ListItem
          key={name}
          mx={0}
          px="$5"
          onPress={() => {}}
          avatarProps={{ src: logoURI }}
          renderItemText={
            <XStack justifyContent="space-between" flex={1}>
              <XStack gap="$2">
                <SizableText size="$bodyLgMedium">{name}</SizableText>
                {/* <Badge badgeType="critical" badgeSize="sm" userSelect="none">
                  <Badge.Text>Hot</Badge.Text>
                </Badge> */}
              </XStack>
              <XStack>
                <SizableText size="$bodyLgMedium">{`${apr} APR`}</SizableText>
              </XStack>
            </XStack>
          }
        />
      ))}
    </YStack>
  );
}

function BasicEarnHome() {
  const {
    activeAccount: { account, accountName, network },
  } = useActiveAccount({ num: 0 });

  const {
    result: { assets },
  } = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceStaking.getAvailableAssets();
      return r;
    },
    [],
    {
      initResult: {
        assets: [],
      },
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  console.log('---list', assets);

  if (network?.chainId === '0') {
    // allNetworks
  }

  if (!account) {
    // create account
  }

  if (account && network) {
    console.log('account----', account, accountName, network);
    const { indexedAccountId } = account;
    const { id: networkId } = network;
    return (
      <Page scrollEnabled>
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.earn}
          showHeaderRight={false}
        />
        <Page.Body>
          <YStack alignItems="center" py="$5">
            <YStack maxWidth="$180" w="100%" gap="$8">
              <Overview indexedAccountId={indexedAccountId} assets={assets} />
              <AvailableAssets assets={assets} />
            </YStack>
          </YStack>
        </Page.Body>
      </Page>
    );
  }
  return null;
}

export default function EarnHome() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.earn,
        sceneUrl: '',
      }}
      enabledNum={[0, 1]}
    >
      <BasicEarnHome />
    </AccountSelectorProviderMirror>
  );
}
