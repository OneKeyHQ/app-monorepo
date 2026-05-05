import { memo, useCallback, useMemo, useState } from 'react';

import {
  Divider,
  ESwitchSize,
  Page,
  ScrollView,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';
import { useKeylessWalletFeatureIsEnabled } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';

import { TabSettingsListItem, TabSettingsSection } from '../Tab/ListItem';
import { useIsTabNavigator } from '../Tab/useIsTabNavigator';

function KeylessWalletPageView() {
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();
  const isTabNavigator = useIsTabNavigator();

  // TODO: Get actual keyless wallet enabled state from API
  const [keylessWalletEnabled, setKeylessWalletEnabled] = useState(false);

  const titleProps = useMemo(
    () => ({
      size: (isTabNavigator
        ? '$bodyMdMedium'
        : '$bodyLgMedium') as ISizableTextProps['size'],
    }),
    [isTabNavigator],
  );

  const iconProps = useMemo(
    () => ({
      size: (isTabNavigator ? '$5' : '$6') as IIconProps['size'],
    }),
    [isTabNavigator],
  );

  const handleToggleKeylessWallet = useCallback((value: boolean) => {
    // TODO: Call API to toggle keyless wallet
    setKeylessWalletEnabled(value);
    console.log('Toggle keyless wallet:', value);
  }, []);

  const handleKeysRecovery = useCallback(() => {
    // TODO: Navigate to keys & recovery page
    console.log('Keys & Recovery');
  }, []);

  if (!isKeylessWalletEnabled) {
    return null;
  }

  return (
    <Page scrollEnabled>
      <Page.Header title="Keyless wallet" />
      <Page.Body>
        <ScrollView contentContainerStyle={{ pb: '$10' }}>
          <YStack gap="$4" px="$4" pt={isTabNavigator ? undefined : '$3'}>
            <TabSettingsSection>
              <TabSettingsListItem
                icon="CloudOutline"
                iconProps={iconProps}
                title="Keyless Wallet"
                titleProps={titleProps}
              >
                <Switch
                  size={ESwitchSize.small}
                  value={keylessWalletEnabled}
                  onChange={handleToggleKeylessWallet}
                />
              </TabSettingsListItem>
              <XStack mx="$5">
                <Divider borderColor="$neutral3" />
              </XStack>
              <TabSettingsListItem
                icon="Key2Outline"
                iconProps={iconProps}
                title="Keys & Recovery"
                titleProps={titleProps}
                drillIn
                onPress={handleKeysRecovery}
              />
            </TabSettingsSection>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default memo(KeylessWalletPageView);
