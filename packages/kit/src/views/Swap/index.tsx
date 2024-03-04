import { memo } from 'react';

import {
  Page,
  ScrollView,
  SizableText,
  Stack,
  Switch,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorActiveAccountLegacy,
  AccountSelectorProviderMirror,
  AccountSelectorTriggerSwap,
} from '../../components/AccountSelector';

const SwapToAnotherAccountSwitch = () => {
  const [settings, setSettings] = useSettingsPersistAtom();

  return (
    <Switch
      value={!!settings.swapToAnotherAccountSwitchOn}
      onChange={() => {
        setSettings((v) => ({
          ...v,
          swapToAnotherAccountSwitchOn: !v.swapToAnotherAccountSwitchOn,
        }));
      }}
    />
  );
};

const Swap = () => {
  console.log('swap');

  return (
    <Page>
      <Page.Body space="$4">
        <ScrollView>
          <SizableText>Swap</SizableText>
          <AccountSelectorProviderMirror
            config={{
              sceneName: EAccountSelectorSceneName.swap,
              sceneUrl: '',
            }}
            enabledNum={[0, 1]}
          >
            <AccountSelectorTriggerSwap num={0} showNetworkSelector />
            <AccountSelectorActiveAccountLegacy num={0} />

            <AccountSelectorTriggerSwap num={1} showNetworkSelector />
            <AccountSelectorActiveAccountLegacy num={1} />

            <Stack flexDirection="row" alignItems="center" space="$2">
              <SwapToAnotherAccountSwitch />
              <SizableText>Swap to another account</SizableText>
            </Stack>
          </AccountSelectorProviderMirror>
        </ScrollView>
      </Page.Body>
    </Page>
  );
};

export default memo(Swap);
