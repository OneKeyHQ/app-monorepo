import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getThirdPartyDeviceAvatarImage } from '@onekeyhq/shared/src/utils/avatarUtils';
import { getThirdPartyDeviceDisplayName } from '@onekeyhq/shared/src/utils/thirdPartyDeviceName';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';

import { ListItem } from '../ListItem';
import { WalletAvatar } from '../WalletAvatar';

import type { DeviceSelectionContext } from '@onekeyfe/hwk-adapter-core';
import type { IntlShape } from 'react-intl';

export type IThirdPartyDeviceSelectionDialogParams = {
  targets: IThirdPartyHardwareSearchTarget[];
  onSelected: (searchTargetId: string) => void | Promise<void>;
  onClose?: () => void | Promise<void>;
  context?: DeviceSelectionContext;
};

function getTargetDescription(target: IThirdPartyHardwareSearchTarget) {
  if (target.vendor === EHardwareVendor.keystone) return undefined;
  return target.serialNumber || target.modelName || target.model;
}

function getTargetAvatar(target: IThirdPartyHardwareSearchTarget) {
  let fallback: 'ledger' | 'trezor' | 'keystone' = 'keystone';
  if (target.vendor === EHardwareVendor.ledger) {
    fallback = 'ledger';
  } else if (target.vendor === EHardwareVendor.trezor) {
    fallback = 'trezor';
  }
  return getThirdPartyDeviceAvatarImage({
    vendor: target.vendor,
    vendorModel: target.model,
    vendorModelName: target.modelName,
    fallback,
  });
}

function ThirdPartyDeviceSelectionContent({
  targets,
  onSelected,
  context,
}: IThirdPartyDeviceSelectionDialogParams) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  let bindingDescription =
    ETranslations.hardware_third_party_connect_ledger_message;
  if (targets[0]?.vendor === EHardwareVendor.trezor) {
    bindingDescription = ETranslations.trezor_ble_binding__desc;
  }
  if (context?.reason === 'known-connection-unavailable') {
    bindingDescription = ETranslations.global_connection_failed_help_text;
  }

  const handleSelect = useCallback(
    async (searchTargetId: string) => {
      await onSelected(searchTargetId);
      await dialog.close();
    },
    [dialog, onSelected],
  );

  return (
    <YStack gap="$4" testID="third-party-device-selection-content">
      {context?.kind === 'bind-connection' ? (
        <SizableText color="$textSubdued">
          {intl.formatMessage({
            id: bindingDescription,
          })}
        </SizableText>
      ) : null}
      <YStack mx="$-5">
        {targets.map((target, index) => (
          <ListItem
            key={target.searchTargetId}
            testID={`third-party-device-option-${index}`}
            drillIn
            userSelect="none"
            onPress={() => {
              void handleSelect(target.searchTargetId);
            }}
          >
            <WalletAvatar wallet={undefined} img={getTargetAvatar(target)} />
            <ListItem.Text
              primary={getThirdPartyDeviceDisplayName({
                brand: getVendorProfile(target.vendor).defaultDeviceName,
                modelName: target.modelName,
                model: target.model,
                name: target.label,
              })}
              secondary={getTargetDescription(target)}
              flex={1}
            />
          </ListItem>
        ))}
      </YStack>
      <Button
        testID="third-party-device-selection-cancel"
        onPress={() => {
          void dialog.close();
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_cancel })}
      </Button>
    </YStack>
  );
}

export function showThirdPartyDeviceSelectionDialog({
  targets,
  onSelected,
  onClose,
  intl,
  context,
}: IThirdPartyDeviceSelectionDialogParams & { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id:
        context?.kind === 'bind-connection' &&
        targets[0]?.vendor === EHardwareVendor.trezor
          ? ETranslations.trezor_ble_binding__title
          : ETranslations.device_select_device_popup,
    }),
    showFooter: false,
    renderContent: (
      <ThirdPartyDeviceSelectionContent
        targets={targets}
        onSelected={onSelected}
        context={context}
      />
    ),
    onClose,
  });
}
