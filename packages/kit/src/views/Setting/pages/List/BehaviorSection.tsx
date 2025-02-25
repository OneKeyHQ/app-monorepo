import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Select,
  SizableText,
  Stack,
  Switch,
  YStack,
} from '@onekeyhq/components';
import { useAutoNavigationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import SettingsGroupHeader from './SettingsGroupHeader';
import { SettingsListItemSeparator, SettingsListRow } from './SettingsList';

export const BehaviorSection = memo(() => {
  const intl = useIntl();
  const [autoJumpSettings, setAutoJumpSettings] = useAutoNavigationAtom();

  return (
    <YStack>
      <SettingsGroupHeader
        label={intl.formatMessage({ id: ETranslations.settings_behavior })}
      />
      <YStack bg="$bgSubdued" borderRadius="$2" overflow="hidden">
        <SettingsListRow
          title={intl.formatMessage({
            id: ETranslations.settings_auto_jump_on_launch,
          })}
          renderRight={() => (
            <Switch
              value={autoJumpSettings.enabled}
              onChange={(value) => {
                setAutoJumpSettings((prev) => ({
                  ...prev,
                  enabled: value,
                }));
              }}
            />
          )}
        />

        {autoJumpSettings.enabled ? (
          <>
            <SettingsListItemSeparator />
            <SettingsListRow
              title={intl.formatMessage({
                id: ETranslations.settings_jump_to_page,
              })}
              renderRight={() => (
                <Stack flex={1} maxW="$56">
                  <Select
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
                    value={autoJumpSettings.selectedTab as string}
                    renderTrigger={({ value }) => (
                      <SizableText
                        size="$bodyMd"
                        color="$textSubdued"
                        numberOfLines={1}
                      >
                        {value}
                      </SizableText>
                    )}
                  />
                </Stack>
              )}
              subDescription={intl.formatMessage({
                id: ETranslations.settings_jump_to_page_description,
              })}
            />
          </>
        ) : null}
      </YStack>
    </YStack>
  );
});

BehaviorSection.displayName = 'BehaviorSection';
