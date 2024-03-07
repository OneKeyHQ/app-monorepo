import { type FC } from 'react';

import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAccountSelectorAvailableNetworksMap } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IAccountDerivationListItemProps = {
  num: number;
  title: string;
  icon: string;
};

export type IAccountDerivationConfigItem = {
  num: number;
  title: string;
  icon: string;
  networkIds: string[];
  defaultNetworkId: string;
};

const AccountDerivationListItem: FC<IAccountDerivationListItemProps> = ({
  num,
  title,
  icon,
}) => (
  <DeriveTypeSelectorTrigger
    num={num}
    miniMode
    placement="bottom-end"
    renderTrigger={({ label }) => (
      <ListItem title={title} avatarProps={{ src: icon }}>
        <XStack>
          <SizableText mr="$3">{label}</SizableText>
          <ListItem.DrillIn name="ChevronDownSmallSolid" />
        </XStack>
      </ListItem>
    )}
  />
);

const AccountDerivation = () => {
  const {
    result: { enabledNum, availableNetworksMap, items },
  } = usePromiseResult(
    async () => {
      const { networkIds } =
        await backgroundApiProxy.serviceNetwork.getAllNetworkIds();

      const config: IAccountDerivationConfigItem[] = [
        {
          num: 0,
          title: 'Bitcoin',
          icon: 'https://onekey-asset.com/assets/btc/btc.png',
          networkIds,
          defaultNetworkId: getNetworkIdsMap().btc,
        },
        {
          num: 1,
          title: 'EVM',
          icon: 'https://onekey-asset.com/assets/eth/eth.png',
          networkIds,
          defaultNetworkId: getNetworkIdsMap().eth,
        },
      ];
      if (platformEnv.isDev) {
        config.push({
          num: 10000,
          title: 'Test Bitcoin',
          icon: 'https://onekey-asset.com/assets/tbtc/tbtc.png',
          networkIds,
          defaultNetworkId: getNetworkIdsMap().tbtc,
        });
      }
      return {
        enabledNum: config.map((o) => o.num),
        availableNetworksMap: config.reduce((result, item) => {
          result[item.num] = {
            networkIds: item.networkIds,
            defaultNetworkId: item.defaultNetworkId,
          };
          return result;
        }, {} as IAccountSelectorAvailableNetworksMap),
        items: config,
      };
    },
    [],
    {
      initResult: { enabledNum: [], availableNetworksMap: {}, items: [] },
    },
  );
  return (
    <Page>
      <Stack px="$5" py="$3">
        <SizableText size="$bodyLg">
          If you don't see the accounts you expect, try switching the derivation
          path.
        </SizableText>
      </Stack>
      <AccountSelectorProviderMirror
        enabledNum={enabledNum}
        config={{
          sceneName: EAccountSelectorSceneName.settings,
          sceneUrl: '',
        }}
        availableNetworksMap={availableNetworksMap}
      >
        <Stack>
          {items.map((o) => (
            <AccountDerivationListItem
              key={o.num}
              title={o.title}
              icon={o.icon}
              num={o.num}
            />
          ))}
        </Stack>
      </AccountSelectorProviderMirror>
    </Page>
  );
};

export default AccountDerivation;
