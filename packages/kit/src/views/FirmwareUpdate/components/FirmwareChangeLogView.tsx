import { useCallback, useEffect, useState } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type {
  IAlertType,
  IKeyOfIcons,
  IStackProps,
} from '@onekeyhq/components';
import {
  Accordion,
  Alert,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { Markdown } from '@onekeyhq/components/src/content/Markdown';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EFirmwareUpdateSteps,
  useDevSettingsPersistAtom,
  useFirmwareUpdateDevSettingsPersistAtom,
  useFirmwareUpdateStepInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IFirmwareChangeLog,
  IFirmwareUpdateInfo,
} from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';
import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';
import { FirmwareUpdateTestIDs } from '../testIDs';
import {
  getFirmwareUpdateUSBPreflightParams,
  getProtocolV2FirmwareVersionDisplayItems,
  getProtocolV2FirmwareVersionTitle,
} from '../utils';

import { FirmwareUpdateIntroduction } from './FirmwareUpdateIntroduction';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareVersionProgressText } from './FirmwareVersionProgressBar';

import type { IProtocolV2FirmwareVersionDisplayItem } from '../utils';

function FirmwareVersionOnlyProgressText({
  fromVersion = '',
  toVersion,
  active,
}: {
  fromVersion?: string | null;
  toVersion?: string | null;
  active: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  const textColor = active ? '$text' : '$textSubdued';
  const versionTextProps = {
    size: '$bodyLgMedium',
    minWidth: 0,
    flexShrink: 1,
    numberOfLines: 1,
  } as const;
  const fromVersionText = versionValid(fromVersion ?? '')
    ? fromVersion
    : unknownMessage;
  const toVersionText = versionValid(toVersion ?? '')
    ? toVersion
    : unknownMessage;

  return (
    <XStack alignItems="center" gap="$1.5" minWidth={0} flexShrink={1}>
      <SizableText {...versionTextProps} color={textColor}>
        {fromVersionText}
      </SizableText>
      {toVersion ? (
        <>
          <Icon
            name="ArrowRightSolid"
            size="$4"
            color={textColor}
            flexShrink={0}
          />
          <SizableText {...versionTextProps} color={textColor}>
            {toVersionText}
          </SizableText>
        </>
      ) : null}
    </XStack>
  );
}

function ChangeLogMarkdown({
  changelog,
}: {
  changelog: IFirmwareChangeLog | undefined;
}) {
  const [{ locale }] = useSettingsPersistAtom();
  const [language, setLanguage] = useState(locale);

  useEffect(() => {
    void (async () => {
      if (locale === 'system') {
        setLanguage(await backgroundApiProxy.serviceSetting.getCurrentLocale());
      }
    })();
  }, [locale]);

  return (
    <Markdown>
      {changelog?.[language === 'zh-CN' ? 'zh-CN' : 'en-US'] ||
        'No change log found.'}
    </Markdown>
  );
}

function ChangeLogSection({
  title,
  updateInfo,
  accordionValue,
  versionOnly,
  fromVersion,
  toVersion,
}: {
  title: string;
  accordionValue: string;
  versionOnly?: boolean;
  fromVersion?: string | null;
  toVersion?: string | null;
  updateInfo:
    | IFirmwareUpdateInfo
    | IBleFirmwareUpdateInfo
    | IBootloaderUpdateInfo
    | undefined;
}) {
  return (
    <Accordion.Item value={accordionValue}>
      <Accordion.Trigger
        unstyled
        borderWidth={0}
        flexDirection="row"
        alignItems="center"
        px="$0"
        py="$3"
        mx="$5"
        bg="$transparent"
        // borderTopWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: -2,
        }}
      >
        {({ open }: { open: boolean }) => (
          <>
            <XStack ai="center" gap="$1.5" flex={1} minWidth={0} flexShrink={1}>
              <SizableText
                size="$bodyLgMedium"
                color={open ? '$text' : '$textSubdued'}
                flexShrink={0}
              >
                {title}
              </SizableText>
              {versionOnly ? (
                <FirmwareVersionOnlyProgressText
                  fromVersion={fromVersion ?? updateInfo?.fromVersion}
                  toVersion={toVersion ?? updateInfo?.toVersion}
                  active={open}
                />
              ) : (
                <FirmwareVersionProgressText
                  fromVersion={updateInfo?.fromVersion}
                  fromFirmwareType={updateInfo?.fromFirmwareType}
                  toVersion={updateInfo?.toVersion}
                  toFirmwareType={updateInfo?.toFirmwareType}
                  githubReleaseUrl={updateInfo?.githubReleaseUrl}
                  active={open}
                />
              )}
            </XStack>
            <Stack
              transition="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={open ? '-180deg' : '0deg'}
              flexShrink={0}
            >
              <Icon
                name="ChevronDownSmallOutline"
                size="$6"
                color={open ? '$icon' : '$iconSubdued'}
              />
            </Stack>
          </>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator transition="quick">
        <Accordion.Content
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          exitStyle={{ opacity: 0 }}
          px="$5"
          pb="$5"
          pt="$0"
        >
          <Stack mt="$-2.5">
            <ChangeLogMarkdown changelog={updateInfo?.changelog} />
          </Stack>
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

function ProtocolV2VersionSection({
  item,
}: {
  item: IProtocolV2FirmwareVersionDisplayItem;
}) {
  const intl = useIntl();
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      minWidth={0}
      px="$5"
      py="$3"
    >
      <SizableText size="$bodyLgMedium" color="$textSubdued" flexShrink={0}>
        {getProtocolV2FirmwareVersionTitle({ target: item.target, intl })}
      </SizableText>
      {item.releaseIdentifierOnly ? (
        <SizableText
          size="$bodyLgMedium"
          color="$textSubdued"
          minWidth={0}
          flexShrink={1}
          numberOfLines={1}
        >
          {item.targetVersion ??
            intl.formatMessage({
              id: ETranslations.hardware_status_update_available,
            })}
        </SizableText>
      ) : (
        <FirmwareVersionOnlyProgressText
          fromVersion={item.currentVersion}
          toVersion={item.targetVersion}
          active={false}
        />
      )}
    </XStack>
  );
}

export function FirmwareChangeLogContentView({
  result,
  ...rest
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
} & IStackProps) {
  const intl = useIntl();
  const [devSettings] = useDevSettingsPersistAtom();
  const [firmwareDevSettings] = useFirmwareUpdateDevSettingsPersistAtom();
  const hideDebugInfo =
    devSettings.enabled &&
    result?.deviceType === 'pro2' &&
    firmwareDevSettings.hidePro2FirmwareDebugInfo === true;
  const protocolV2VersionItems = getProtocolV2FirmwareVersionDisplayItems(
    result,
    { includeComponents: devSettings.enabled && !hideDebugInfo },
  );
  const [safeOSItem, ...componentItems] = protocolV2VersionItems;
  if (safeOSItem) {
    return (
      <Stack {...rest}>
        <Accordion
          overflow="hidden"
          width="100%"
          type="single"
          defaultValue="safeos"
          collapsible
        >
          <ChangeLogSection
            title="SafeOS"
            updateInfo={result?.updateInfos?.firmware}
            accordionValue="safeos"
            versionOnly
            fromVersion={safeOSItem.currentVersion}
            toVersion={safeOSItem.targetVersion}
          />
        </Accordion>
        {componentItems.map((item) => (
          <ProtocolV2VersionSection key={item.target} item={item} />
        ))}
      </Stack>
    );
  }

  const defaultExpandedSections = (() => {
    if (result?.updateInfos?.firmware?.hasUpgrade) {
      return 'firmware';
    }
    if (result?.updateInfos?.bootloader?.hasUpgrade) {
      return 'bootloader';
    }
    if (result?.updateInfos?.ble?.hasUpgrade) return 'ble';
    return undefined;
  })();

  return (
    <Stack {...rest}>
      <Accordion
        overflow="hidden"
        width="100%"
        type="single"
        defaultValue={defaultExpandedSections}
        collapsible
      >
        {result?.updateInfos?.firmware?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_firmware })}
            updateInfo={result?.updateInfos?.firmware}
            accordionValue="firmware"
          />
        ) : null}
        {result?.updateInfos?.bootloader?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bootloader })}
            updateInfo={result?.updateInfos?.bootloader}
            accordionValue="bootloader"
          />
        ) : null}
        {result?.updateInfos?.ble?.hasUpgrade ? (
          <ChangeLogSection
            title={intl.formatMessage({ id: ETranslations.global_bluetooth })}
            updateInfo={result?.updateInfos?.ble}
            accordionValue="ble"
          />
        ) : null}
      </Accordion>
    </Stack>
  );
}

export function FirmwareChangeLogChangeFirmwareWarnView({
  content,
  type,
}: {
  content: string;
  type?: IAlertType;
}) {
  let icon: IKeyOfIcons | undefined;
  if (type === 'info') {
    icon = 'InfoCircleOutline';
  } else if (type === 'warning') {
    icon = 'InfoCircleOutline';
  } else if (type === 'danger') {
    icon = 'ErrorOutline';
  }

  return (
    <Alert
      mx="$5"
      my="$2.5"
      type={type}
      title={content}
      icon={icon}
      closable={false}
    />
  );
}

export function FirmwareChangeFirmwareWarn({
  result,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();

  if (!result?.updateInfos?.firmware) return null;
  const firmwareInfo = result?.updateInfos?.firmware;
  if (
    firmwareInfo.fromFirmwareType === undefined ||
    firmwareInfo.toFirmwareType === undefined ||
    firmwareInfo.fromFirmwareType === firmwareInfo.toFirmwareType
  )
    return null;

  const tips: { content: string; type?: IAlertType }[] = [];

  if (firmwareInfo?.toFirmwareType === EFirmwareType.BitcoinOnly) {
    tips.push({
      content: intl.formatMessage({
        id: ETranslations.device_change_to_btc_only_banner,
      }),
      type: 'info',
    });
  }

  tips.push({
    content: intl.formatMessage({
      // oxlint-disable-next-line @cspell/spellchecker
      id: ETranslations.device_wipe_data_bannner,
    }),
    type: 'danger',
  });
  tips.push({
    content: intl.formatMessage({
      id: ETranslations.device_recover_data_banner,
    }),
    type: 'danger',
  });

  return (
    <>
      {tips.map((item, index) => (
        <FirmwareChangeLogChangeFirmwareWarnView
          key={`${index}`}
          content={item.content}
          type={item.type}
        />
      ))}
    </>
  );
}

export function FirmwareChangeLogView({
  result,
  onConfirmClick,
  onRetryClick,
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  onConfirmClick?: () => void;
  onRetryClick?: () => void | Promise<void>;
}) {
  const intl = useIntl();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const { showCheckList } = useFirmwareUpdateActions();

  const handleConfirmClick = useCallback(async () => {
    if (onRetryClick) {
      await onRetryClick();
      return;
    }
    if (platformEnv.isDesktop) {
      const usbPreflightParams =
        await getFirmwareUpdateUSBPreflightParams(result);
      const isUSBDeviceAvailable =
        await backgroundApiProxy.serviceHardware.detectUSBDeviceAvailability(
          usbPreflightParams,
        );
      if (!isUSBDeviceAvailable) {
        Dialog.show({
          icon: 'TypeCoutline',
          title: intl.formatMessage({
            id: ETranslations.upgrade_use_usb,
          }),
          description: intl.formatMessage({
            id: ETranslations.upgrade_recommend_usb,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_got_it,
          }),
          showCancelButton: false,
        });
        return;
      }
    }
    setStepInfo({
      step: EFirmwareUpdateSteps.showCheckList,
      payload: undefined,
    });
    const updateFirmwareInfo = result?.updateInfos?.firmware;
    if (
      updateFirmwareInfo?.fromFirmwareType !== undefined &&
      updateFirmwareInfo?.toFirmwareType !== undefined &&
      updateFirmwareInfo.fromFirmwareType !== updateFirmwareInfo.toFirmwareType
    ) {
      defaultLogger.update.firmware.firmwareSwitchStart({
        deviceType: result?.deviceType,
        fromFirmwareType: updateFirmwareInfo.fromFirmwareType,
        toFirmwareType: updateFirmwareInfo.toFirmwareType,
      });
    }
    showCheckList({ result });
    onConfirmClick?.();
  }, [result, showCheckList, onConfirmClick, onRetryClick, setStepInfo, intl]);

  const updateFirmwareInfo = result?.updateInfos?.firmware;

  const showUpdateIntroduction =
    updateFirmwareInfo?.fromFirmwareType !== undefined &&
    updateFirmwareInfo?.toFirmwareType !== undefined &&
    updateFirmwareInfo?.fromFirmwareType !== updateFirmwareInfo?.toFirmwareType;

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirmText={intl.formatMessage({
          id: onRetryClick
            ? ETranslations.global_retry
            : ETranslations.update_update_now,
        })}
        onConfirm={handleConfirmClick}
        confirmButtonProps={{
          testID: FirmwareUpdateTestIDs.updateNowBtn,
        }}
      />
      {showUpdateIntroduction ? <FirmwareUpdateIntroduction /> : null}
      <FirmwareChangeFirmwareWarn result={result} />
      <FirmwareChangeLogContentView result={result} />
    </>
  );
}
