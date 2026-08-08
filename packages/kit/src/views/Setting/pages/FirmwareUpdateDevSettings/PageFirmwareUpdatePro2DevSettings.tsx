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
import type { IFirmwareUpdateDevSettings } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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

  const updateTargets = useCallback(
    async ({
      nextTargets,
      nextOnceTargets,
    }: {
      nextTargets: IPro2FirmwareUpdateTarget[];
      nextOnceTargets: IPro2FirmwareUpdateTarget[];
    }) => {
      const values = {
        pro2ForceUpdateTargets: nextTargets,
        pro2ForceUpdateOnceTargets: nextOnceTargets,
      };
      setDevSetting((previous) => ({ ...previous, ...values }));
      await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
        values,
      );
    },
    [setDevSetting],
  );

  const setTargetEnabled = useCallback(
    async (enabled: boolean) => {
      const nextTargets = enabled
        ? Array.from(new Set([...targets, target.value]))
        : targets.filter((item) => item !== target.value);
      const nextOnceTargets = enabled
        ? onceTargets.filter((item) => item !== target.value)
        : onceTargets;
      await updateTargets({ nextTargets, nextOnceTargets });
    },
    [onceTargets, target.value, targets, updateTargets],
  );

  const setOnceTargetEnabled = useCallback(
    async (enabled: boolean) => {
      const nextOnceTargets = enabled
        ? Array.from(new Set([...onceTargets, target.value]))
        : onceTargets.filter((item) => item !== target.value);
      const nextTargets = enabled
        ? targets.filter((item) => item !== target.value)
        : targets;
      await updateTargets({ nextTargets, nextOnceTargets });
    },
    [onceTargets, target.value, targets, updateTargets],
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
            value={targets.includes(target.value)}
            onChange={setTargetEnabled}
            testID={`pro2-firmware-force-${target.value}`}
          />
        </YStack>
        <YStack alignItems="center" gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            once
          </SizableText>
          <Switch
            size={ESwitchSize.small}
            value={onceTargets.includes(target.value)}
            onChange={setOnceTargetEnabled}
            testID={`pro2-firmware-force-once-${target.value}`}
          />
        </YStack>
      </XStack>
    </ListItem>
  );
}

function FirmwareUpdatePro2DevSettings() {
  const [devSetting, setDevSetting] = useFirmwareUpdateDevSettingsPersistAtom();

  const resetPro2ForceTargets = useCallback(async () => {
    const values: Pick<
      IFirmwareUpdateDevSettings,
      'pro2ForceUpdateTargets' | 'pro2ForceUpdateOnceTargets'
    > = {
      pro2ForceUpdateTargets: [],
      pro2ForceUpdateOnceTargets: [],
    };
    setDevSetting((previous) => ({ ...previous, ...values }));
    await backgroundApiProxy.serviceDevSetting.updateFirmwareUpdateDevSettings(
      values,
    );
  }, [setDevSetting]);

  return (
    <YStack>
      <ListItem
        title="Pro2 force targets"
        subtitle="Select persistent or one-time targets used for release planning and firmwareUpdateV4"
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
