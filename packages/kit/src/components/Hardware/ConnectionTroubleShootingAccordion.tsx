import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IAccordionSingleProps } from '@onekeyhq/components';
import {
  Accordion,
  Anchor,
  Heading,
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

// Define stable components outside of render function to avoid React warnings
function LinkComponent({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Anchor href={href} target="_blank" size="$bodyMd" color="$textInfo">
      {children}
    </Anchor>
  );
}

export function ConnectionTroubleShootingAccordion({
  connectionType,
  indent = true,
  ...rest
}: {
  connectionType: 'bluetooth' | 'usb';
  indent?: boolean;
} & Partial<IAccordionSingleProps>) {
  const intl = useIntl();

  // Create stable tag functions to avoid React warnings
  const bridgeLinkTag = useCallback(
    (chunks: ReactNode[]) => (
      <LinkComponent href="https://help.onekey.so/articles/11461190">
        {chunks}
      </LinkComponent>
    ),
    [],
  );

  const contactUsLinkTag = useCallback(
    (chunks: ReactNode[]) => (
      <SizableText
        size="$bodyMd"
        color="$textInfo"
        cursor="default"
        onPress={() => {
          void showIntercom();
        }}
      >
        {chunks}
      </SizableText>
    ),
    [],
  );

  const solutions = useMemo(
    () => ({
      usb: [
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_replug_usb_cable,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_connect_and_unlock,
          }),
        ],
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_change_usb_port,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_remove_usb_dongles,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_connect_and_unlock,
          }),
        ],
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_use_original_usb_cable,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_try_different_usb_cable,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_connect_and_unlock,
          }),
        ],
        [
          intl.formatMessage(
            { id: ETranslations.troubleshooting_check_bridge },
            {
              tag: bridgeLinkTag,
            },
          ),
          intl.formatMessage({
            id: ETranslations.troubleshooting_close_other_onekey_app,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_connect_and_unlock,
          }),
        ],
      ],
      bluetooth: [
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_device_powered_on,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_desktop_bluetooth_usb_priority,
          }),
        ],
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_check_bluetooth,
          }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_unlock_device,
          }),
        ],
        [
          intl.formatMessage({
            id: ETranslations.troubleshooting_remove_device_from_bluetooth_list,
          }),
          intl.formatMessage({ id: ETranslations.troubleshooting_restart_app }),
          intl.formatMessage({
            id: ETranslations.troubleshooting_reconnect_and_pair,
          }),
        ],
      ],
      common: [
        [
          intl.formatMessage(
            { id: ETranslations.troubleshooting_request },
            {
              tag: contactUsLinkTag,
            },
          ),
        ],
      ],
    }),
    [intl, bridgeLinkTag, contactUsLinkTag],
  );

  const getTroubleshootingSolutions = () => {
    if (connectionType === 'usb')
      return [...solutions.usb, ...solutions.common];
    if (connectionType === 'bluetooth')
      return [...solutions.bluetooth, ...solutions.common];
    return [...solutions.usb, ...solutions.bluetooth, ...solutions.common];
  };

  return (
    <Accordion type="single" defaultValue="0" collapsible {...rest}>
      {getTroubleshootingSolutions().map((list, index) => (
        <Accordion.Item value={index.toString()} key={index.toString()}>
          <Accordion.Trigger
            unstyled
            flexDirection="row"
            alignItems="center"
            borderWidth={0}
            px={indent ? '$5' : 0}
            py="$2"
            bg="$transparent"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{
              bg: '$bgActive',
            }}
            focusVisibleStyle={{
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineColor: '$focusRing',
              outlineOffset: 0,
            }}
            {...(index !== 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: '$borderSubdued',
            })}
          >
            {({ open }: { open: boolean }) => (
              <>
                <Heading
                  flex={1}
                  size={open ? '$headingSm' : '$bodyMd'}
                  textAlign="left"
                  color={open ? '$text' : '$textSubdued'}
                >
                  {index === getTroubleshootingSolutions().length - 1
                    ? intl.formatMessage({
                        id: ETranslations.troubleshooting_fallback_solution_label,
                      })
                    : intl.formatMessage(
                        { id: ETranslations.troubleshooting_solution_x },
                        {
                          number: index + 1,
                        },
                      )}
                </Heading>
                <Stack animation="quick" rotate={open ? '-180deg' : '0deg'}>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color={open ? '$iconActive' : '$iconSubdued'}
                    size="$5"
                  />
                </Stack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator animation="quick">
            <Accordion.Content
              unstyled
              animation="quick"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            >
              <Stack
                role="list"
                px={indent ? '$5' : 0}
                pt="$1"
                pb="$3"
                gap="$2"
              >
                {list.map((item, subIndex) => (
                  <XStack role="listitem" key={subIndex} gap="$2">
                    <SizableText
                      w="$4"
                      flexShrink={0}
                      size="$bodyMd"
                      color="$textSubdued"
                    >
                      {subIndex + 1}.
                    </SizableText>
                    <SizableText
                      flex={1}
                      $md={{
                        maxWidth: '$78',
                      }}
                      size="$bodyMd"
                    >
                      {item}
                    </SizableText>
                  </XStack>
                ))}
              </Stack>
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

export function DeviceNotFoundDialogContent({
  connectId,
  inBluetoothCommunication,
}: {
  connectId: string | undefined;
  inBluetoothCommunication?: boolean;
}) {
  const intl = useIntl();

  const { result } = usePromiseResult(async () => {
    if (!connectId) {
      return {
        device: undefined,
      };
    }
    const device =
      await backgroundApiProxy.serviceHardware.getDeviceByConnectId({
        connectId,
      });
    return {
      device,
    };
  }, [connectId]);

  const showUsbTroubleshooting = useMemo(() => {
    if (platformEnv.isNative) {
      return false;
    }
    if (platformEnv.isSupportDesktopBle) {
      return (
        connectId &&
        result?.device?.connectId === connectId &&
        !inBluetoothCommunication
      );
    }
    return true;
  }, [connectId, result?.device?.connectId, inBluetoothCommunication]);

  const showBluetoothTroubleshooting = useMemo(() => {
    if (platformEnv.isNative) {
      return true;
    }
    if (platformEnv.isSupportDesktopBle) {
      return (
        (connectId && result?.device?.bleConnectId === connectId) ||
        inBluetoothCommunication
      );
    }
    return false;
  }, [connectId, result?.device?.bleConnectId, inBluetoothCommunication]);

  const renderUsbTroubleshooting = useCallback(
    () => (
      <YStack>
        <XStack alignItems="center" gap={7} mb="$2">
          <Icon name="TypeCoutline" size="$3.5" />
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.troubleshooting_usb,
            })}
          </SizableText>
        </XStack>
        <YStack>
          <ConnectionTroubleShootingAccordion
            connectionType="usb"
            defaultValue={undefined}
            indent={false}
          />
        </YStack>
      </YStack>
    ),
    [intl],
  );

  const renderBluetoothTroubleshooting = useCallback(
    () => (
      <YStack
        mt={
          showUsbTroubleshooting ||
          (!showUsbTroubleshooting && !showBluetoothTroubleshooting)
            ? '$5'
            : undefined
        }
      >
        <XStack alignItems="center" gap={7} mb="$2">
          <Icon name="BluetoothOutline" size="$3.5" />
          <SizableText size="$headingSm">
            {intl.formatMessage({
              id: ETranslations.troubleshooting_bluetooth,
            })}
          </SizableText>
        </XStack>
        <YStack>
          <ConnectionTroubleShootingAccordion
            connectionType="bluetooth"
            defaultValue={undefined}
            indent={false}
          />
        </YStack>
      </YStack>
    ),
    [intl, showUsbTroubleshooting, showBluetoothTroubleshooting],
  );

  return (
    <ScrollView maxHeight={480}>
      {showUsbTroubleshooting ? renderUsbTroubleshooting() : null}
      {showBluetoothTroubleshooting ? renderBluetoothTroubleshooting() : null}
      {!showUsbTroubleshooting && !showBluetoothTroubleshooting ? (
        <>
          {renderUsbTroubleshooting()}
          {renderBluetoothTroubleshooting()}
        </>
      ) : null}
    </ScrollView>
  );
}
