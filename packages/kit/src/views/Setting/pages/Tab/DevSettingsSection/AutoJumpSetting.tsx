import { memo } from 'react';

import {
  ESwitchSize,
  Select,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import type { ISelectRenderTriggerProps } from '@onekeyhq/components/src/forms/Select/type';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

export const AutoJumpSetting = memo(() => {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();
  const defaultAutoNavigation = {
    enabled: true,
    selectedTab: ETabRoutes.Discovery,
  };
  const autoNavigation =
    devSettings.settings?.autoNavigation || defaultAutoNavigation;

  return (
    <YStack>
      <YStack borderRadius="$2" overflow="hidden">
        <ListItem
          icon="UfoOutline"
          title="Auto Jump on Launch"
          onPress={() => {
            setDevSettings((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                autoNavigation: {
                  ...autoNavigation,
                  enabled: !autoNavigation.enabled,
                },
              },
            }));
          }}
        >
          <Switch
            size={ESwitchSize.small}
            value={autoNavigation.enabled}
            onChange={(value: boolean) => {
              setDevSettings((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  autoNavigation: {
                    ...autoNavigation,
                    enabled: value,
                  },
                },
              }));
            }}
          />
        </ListItem>

        {autoNavigation.enabled ? (
          <>
            <ListItem.Separator />
            <ListItem
              title="Jump to Page"
              subtitle="Choose which page to open when launching the app"
            >
              <Stack>
                <Select
                  title="Select Page"
                  items={[
                    { label: 'Home', value: ETabRoutes.Home },
                    { label: 'Discovery', value: ETabRoutes.Discovery },
                    { label: 'Earn', value: ETabRoutes.Earn },
                    { label: 'Swap', value: ETabRoutes.Swap },
                    { label: 'Market', value: ETabRoutes.Market },
                    ...(platformEnv.isDev
                      ? [{ label: 'Developer', value: ETabRoutes.Developer }]
                      : []),
                  ]}
                  onChange={(value) => {
                    setDevSettings((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        autoNavigation: {
                          ...autoNavigation,
                          selectedTab: value as ETabRoutes,
                        },
                      },
                    }));
                  }}
                  value={autoNavigation.selectedTab ?? ETabRoutes.Home}
                  renderTrigger={(props: ISelectRenderTriggerProps) => (
                    <SizableText size="$bodyLgMedium" color="$textSubdued">
                      {props.value?.toString() || ''}
                    </SizableText>
                  )}
                />
              </Stack>
            </ListItem>
          </>
        ) : null}
      </YStack>
    </YStack>
  );
});

AutoJumpSetting.displayName = 'AutoJumpSetting';
