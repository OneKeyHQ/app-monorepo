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
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useFirmwareUpdateDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { applyPro2FirmwareForceTargetChange } from '@onekeyhq/kit-bg/src/states/jotai/atoms/applyPro2FirmwareForceTargetChange';
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
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();
  const targets =
    devSetting.pro2ForceUpdateTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;
  const onceTargets =
    devSetting.pro2ForceUpdateOnceTargets ?? EMPTY_PRO2_FIRMWARE_UPDATE_TARGETS;
  const forceEnabled = targets.includes(target.value);
  const onceEnabled = onceTargets.includes(target.value);

  const toggleTarget = useCallback(
    (mode: IPro2FirmwareForceTargetMode, enabled: boolean) => {
      setDevSetting((previous) => ({
        ...previous,
        ...applyPro2FirmwareForceTargetChange({
          enabled,
          mode,
          onceTargets: previous.pro2ForceUpdateOnceTargets ?? [],
          target: target.value,
          targets: previous.pro2ForceUpdateTargets ?? [],
        }),
      }));
    },
    [setDevSetting, target.value],
  );

  return (
    <ListItem title={target.label} titleProps={{ color: '$textCritical' }}>
      <XStack gap="$4" alignItems="center">
        <YStack
          alignItems="center"
          gap="$1"
          px="$2"
          py="$1"
          cursor="pointer"
          onPress={() => toggleTarget('force', !forceEnabled)}
        >
          <SizableText size="$bodySm" color="$textSubdued">
            force
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={forceEnabled}
            pointerEvents="none"
            testID={`pro2-firmware-force-${target.value}`}
          />
        </YStack>
        <YStack
          alignItems="center"
          gap="$1"
          px="$2"
          py="$1"
          cursor="pointer"
          onPress={() => toggleTarget('once', !onceEnabled)}
        >
          <SizableText size="$bodySm" color="$textSubdued">
            once
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={onceEnabled}
            pointerEvents="none"
            testID={`pro2-firmware-force-once-${target.value}`}
          />
        </YStack>
      </XStack>
    </ListItem>
  );
}

function FirmwareUpdatePro2DevSettings() {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();

  const resetPro2ForceTargets = useCallback(() => {
    setDevSetting((previous) => ({
      ...previous,
      pro2ForceUpdateOnceTargets: [],
      pro2ForceUpdateTargets: [],
    }));
  }, [setDevSetting]);

  return (
    <YStack>
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
          onPress={resetPro2ForceTargets}
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
