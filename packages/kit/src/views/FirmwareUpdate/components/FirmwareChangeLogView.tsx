import { useCallback, useEffect, useMemo, useState } from 'react';

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
  Markdown,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EFirmwareUpdateSteps,
  useFirmwareUpdateStepInfoAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBleFirmwareUpdateInfo,
  IBootloaderUpdateInfo,
  ICheckAllFirmwareReleaseResult,
  IFirmwareChangeLog,
  IFirmwareUpdateInfo,
} from '@onekeyhq/shared/types/device';

import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { FirmwareUpdateIntroduction } from './FirmwareUpdateIntroduction';
import { FirmwareUpdatePageFooter } from './FirmwareUpdatePageLayout';
import { FirmwareVersionProgressText } from './FirmwareVersionProgressBar';

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
}: {
  title: string;
  accordionValue: string;
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
            <XStack ai="center" gap="$1.5" flex={1}>
              <SizableText
                size="$bodyLgMedium"
                color={open ? '$text' : '$textSubdued'}
              >
                {title}
              </SizableText>
              <FirmwareVersionProgressText
                fromVersion={updateInfo?.fromVersion}
                fromFirmwareType={updateInfo?.fromFirmwareType}
                toVersion={updateInfo?.toVersion}
                toFirmwareType={updateInfo?.toFirmwareType}
                githubReleaseUrl={updateInfo?.githubReleaseUrl}
                active={open}
              />
            </XStack>
            <Stack animation="quick" rotate={open ? '-180deg' : '0deg'}>
              <Icon
                name="ChevronDownSmallOutline"
                size="$6"
                color={open ? '$icon' : '$iconSubdued'}
              />
            </Stack>
          </>
        )}
      </Accordion.Trigger>
      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          animation="quick"
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

export function FirmwareChangeLogContentView({
  result,
  ...rest
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
} & IStackProps) {
  const intl = useIntl();
  const defaultExpandedSections = useMemo(() => {
    if (result?.updateInfos?.firmware?.hasUpgrade) return 'firmware';
    if (result?.updateInfos?.bootloader?.hasUpgrade) return 'bootloader';
    if (result?.updateInfos?.ble?.hasUpgrade) return 'ble';
    return undefined;
  }, [result?.updateInfos]);

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
}: {
  result: ICheckAllFirmwareReleaseResult | undefined;
  onConfirmClick?: () => void;
}) {
  const intl = useIntl();
  const [, setStepInfo] = useFirmwareUpdateStepInfoAtom();
  const { showCheckList } = useFirmwareUpdateActions();

  const handleConfirmClick = useCallback(async () => {
    const isUSBDeviceAvailable =
      await backgroundApiProxy.serviceHardware.detectUSBDeviceAvailability();
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
    setStepInfo({
      step: EFirmwareUpdateSteps.showCheckList,
      payload: undefined,
    });
    showCheckList({ result });
    onConfirmClick?.();
  }, [result, showCheckList, onConfirmClick, setStepInfo, intl]);

  const updateFirmwareInfo = result?.updateInfos?.firmware;

  const showUpdateIntroduction =
    updateFirmwareInfo?.fromFirmwareType !== undefined &&
    updateFirmwareInfo?.toFirmwareType !== undefined &&
    updateFirmwareInfo?.fromFirmwareType !== updateFirmwareInfo?.toFirmwareType;

  return (
    <>
      <FirmwareUpdatePageFooter
        onConfirmText={intl.formatMessage({
          id: ETranslations.update_update_now,
        })}
        onConfirm={handleConfirmClick}
      />
      {showUpdateIntroduction ? <FirmwareUpdateIntroduction /> : null}
      <FirmwareChangeFirmwareWarn result={result} />
      <FirmwareChangeLogContentView result={result} />
    </>
  );
}
