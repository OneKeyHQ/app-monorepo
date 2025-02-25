import { memo } from 'react';

import {
  Select,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import type { ISelectRenderTriggerProps } from '@onekeyhq/components/src/forms/Select/type';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAutoNavigationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

export const AutoJumpSetting = memo(() => {
  const [autoJumpSettings, setAutoJumpSettings] = useAutoNavigationAtom();

  return (
    <YStack>
      <YStack borderRadius="$2" overflow="hidden">
        <ListItem
          title="Auto Jump on Launch"
          onPress={() => {
            setAutoJumpSettings((prev) => ({
              ...prev,
              enabled: !prev.enabled,
            }));
          }}
        >
          <Switch
            value={autoJumpSettings.enabled}
            onChange={(value: boolean) => {
              setAutoJumpSettings((prev) => ({
                ...prev,
                enabled: value,
              }));
            }}
          />
        </ListItem>

        {autoJumpSettings.enabled ? (
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
                      ? [
                          { label: 'Me', value: ETabRoutes.Me },
                          { label: 'Developer', value: ETabRoutes.Developer },
                        ]
                      : []),
                  ]}
                  onChange={(value) => {
                    setAutoJumpSettings((prev) => ({
                      ...prev,
                      selectedTab: value as ETabRoutes,
                    }));
                  }}
                  value={autoJumpSettings.selectedTab ?? ETabRoutes.Home}
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
