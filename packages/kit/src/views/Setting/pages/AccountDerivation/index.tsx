import { type FC } from 'react';

import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
    result: { enabledNum, availableNetworksMap, items },
    isLoading,
  } = usePromiseResult(
    () => backgroundApiProxy.serviceSetting.getAccountDerivationConfig(),
    [],
    {
      initResult: { enabledNum: [], availableNetworksMap: {}, items: [] },
      watchLoading: true,
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
      {!isLoading ? (
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
      ) : null}
    </Page>
  );
};

export default AccountDerivation;
