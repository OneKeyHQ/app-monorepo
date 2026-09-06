import { useCallback } from 'react';

import {
  Button,
  ESwitchSize,
  Page,
  SizableText,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useFirmwareUpdateDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPro2FirmwareForceTargetMode } from '@onekeyhq/kit-bg/src/states/jotai/atoms/applyPro2FirmwareForceTargetChange';
import type { IPro2FirmwareUpdateTarget } from '@onekeyhq/shared/types/device';
import { PRO2_FIRMWARE_UPDATE_TARGETS } from '@onekeyhq/shared/types/device';

import { FirmwareUpdateActions } from '../Tab/DevSettingsSection/FirmwareUpdateActions';

const PRO2_FIRMWARE_UPDATE_TARGET_OPTIONS = PRO2_FIRMWARE_UPDATE_TARGETS.map(
  (value) => ({
    value,
    label: value,
  }),
);

const EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS: IPro2FirmwareUpdateTarget[] = [];

function Pro2FirmwareUpdateTargetRow({
  target,
}: {
  target: (typeof PRO2_FIRMWARE_UPDATE_TARGET_OPTIONS)[number];
}) {
  const [devSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const targets =
    devSetting.pro2ForceUpdateTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;
  const onceTargets =
    devSetting.pro2ForceUpdateOnceTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;
  const forceEnabled = targets.includes(target.value);
  const onceEnabled = onceTargets.includes(target.value);

  const handleChange = useCallback(
    async (mode: IPro2FirmwareForceTargetMode, enabled: boolean) => {
      await backgroundApiProxy.serviceDevSetting.togglePro2FirmwareForceTarget({
        enabled,
        mode,
        target: target.value,
      });
    },
    [target.value],
  );

  return (
    <ListItem title={target.label} titleProps={{ color: '$textCritical' }}>
      <XStack gap="$4" alignItems="center">
        <YStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            force
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={forceEnabled}
            onChange={(enabled) => {
              void handleChange('force', enabled);
            }}
            testID={`pro2-firmware-force-${target.value}`}
          />
        </YStack>
        <YStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            once
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={onceEnabled}
            onChange={(enabled) => {
              void handleChange('once', enabled);
            }}
            testID={`pro2-firmware-force-once-${target.value}`}
          />
        </YStack>
      </XStack>
    </ListItem>
  );
}

function FirmwareUpdatePro2DevSettings() {
  const [devSetting] = useFirmwareUpdateDevSettingsPersistAtom();

  const handleHideDebugInfoChange = useCallback(async (enabled: boolean) => {
    await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings({
      hidePro2FirmwareDebugInfo: enabled,
    });
  }, []);

  const resetPro2ForceTargets = useCallback(async () => {
    await backgroundApiProxy.serviceDevSetting.resetPro2FirmwareForceTargets();
  }, []);

  return (
    <YStack>
      <ListItem
        title="Hide firmware debug info"
        subtitle="Preview the regular Pro2 update UI without component details or progress debug info. Update settings are unchanged."
      >
        <Switch
          size={ESwitchSize.small}
          value={devSetting.hidePro2FirmwareDebugInfo ?? false}
          onChange={(enabled) => {
            void handleHideDebugInfoChange(enabled);
          }}
          testID="pro2-firmware-hide-debug-info"
        />
      </ListItem>
      <ListItem
        title="Pro2 force targets"
        subtitle="Configured resources are included automatically. Resource force/once means reinstall."
        titleProps={{ color: '$textCritical' }}
      />
      {PRO2_FIRMWARE_UPDATE_TARGET_OPTIONS.map((target) => (
        <Pro2FirmwareUpdateTargetRow key={target.value} target={target} />
      ))}
      <XStack px="$5" py="$3" gap="$2">
        <Button
          size="small"
          onPress={() => {
            void resetPro2ForceTargets();
          }}
          testID="pro2-firmware-force-reset"
        >
          Reset Pro2 force targets
        </Button>
      </XStack>
      <SizableText>{JSON.stringify(devSetting, null, 2)}</SizableText>
      <FirmwareUpdateActions />
    </YStack>
  );
}

export default function PageFirmwareUpdatePro2DevSettings() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Pro2 Firmware Dev Settings" />
      <FirmwareUpdatePro2DevSettings />
    </Page>
  );
}
