import { type FC } from 'react';

import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_BTC, IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

type IAccountDerivationListItemProps = {
  num: number;
  title: string;
  icon: string;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    result: { networkIds },
  } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkIdsByImpls({
        impls: [IMPL_BTC, IMPL_EVM],
      }),
    [],
    {
      initResult: {
        networkIds: [],
      },
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
        enabledNum={[0, 1]}
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        availableNetworksMap={{
          0: {
            networkIds,
            defaultNetworkId: getNetworkIdsMap().btc,
          },
          1: {
            networkIds,
            defaultNetworkId: getNetworkIdsMap().eth,
          },
        }}
      >
        <Stack>
          <AccountDerivationListItem
            title="Bitcoin"
            icon="https://onekey-asset.com/assets/btc/btc.png"
            num={0}
          />
          <AccountDerivationListItem
            title="EVM"
            icon="https://onekey-asset.com/assets/eth/eth.png"
            num={1}
          />
        </Stack>
      </AccountSelectorProviderMirror>
    </Page>
  );
};

export default AccountDerivation;
