import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useDeviceDetailsActions,
  useDevicePassphraseEnabledAtom,
  useDevicePinOnAppEnabledAtom,
  useDeviceTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { ListItemGroup } from '../ListItemGroup';

import { useDialogPassphraseEnable } from './dialog/DialogPassphraseEnable';

function DeviceSectionAdvancePassphrase() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [passphraseEnabled] = useDevicePassphraseEnabledAtom();
  const { show: showDialogPassphraseEnable } = useDialogPassphraseEnable();

  const onPressPassphrase = useCallback(
    (value: boolean) => {
      return new Promise<void>((resolve, reject) => {
        showDialogPassphraseEnable({
          needEnterPassphrase: value,
          onConfirmOpenPassphrase: async () => {
            try {
              await actions.updatePassphraseEnabled(value);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          onCancelOpenPassphrase: async () => {
            reject(new Error('User canceled'));
          },
        });
      });
    },
    [actions, showDialogPassphraseEnable],
  );

  return (
    <ListItem.StatefulItem
      mx="$0"
      px="$5"
      py="$3"
      borderRadius="$0"
      $gtMd={{ py: '$0' }}
      title={intl.formatMessage({
        id: ETranslations.global_passphrase,
      })}
      titleProps={{ size: '$bodyMdMedium', color: '$text' }}
      justifyContent="center"
      value={passphraseEnabled}
      onAction={onPressPassphrase}
    >
      {({ value, disabled, onChange }) => (
        <Switch
          size="small"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </ListItem.StatefulItem>
  );
}

function DeviceSectionAdvanceInputPinOnSoftware() {
  const intl = useIntl();
  const [deviceType] = useDeviceTypeAtom();
  const inputPinOnSoftwareSupport =
    deviceType && deviceUtils.checkInputPinOnSoftwareSupport(deviceType);
  const [inputPinOnSoftwareEnabled] = useDevicePinOnAppEnabledAtom();

  const actions = useDeviceDetailsActions();

  if (!inputPinOnSoftwareSupport) return null;

  return (
    <ListItem.StatefulItem
      mx="$0"
      px="$5"
      py="$3"
      borderRadius="$0"
      $gtMd={{ py: '$0' }}
      title={intl.formatMessage({
        id: ETranslations.enter_pin_on_app,
      })}
      titleProps={{ size: '$bodyMdMedium', color: '$text' }}
      justifyContent="center"
      value={inputPinOnSoftwareEnabled}
      onAction={actions.updateInputPinOnSoftware}
    >
      {({ value, disabled, onChange }) => (
        <Switch
          size="small"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </ListItem.StatefulItem>
  );
}

function DeviceSectionAdvance() {
  const intl = useIntl();
  const [deviceType] = useDeviceTypeAtom();
  const inputPinOnSoftwareSupport =
    deviceType && deviceUtils.checkInputPinOnSoftwareSupport(deviceType);

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_advance,
      })}
    >
      <DeviceSectionAdvancePassphrase />
      {inputPinOnSoftwareSupport ? (
        <DeviceSectionAdvanceInputPinOnSoftware />
      ) : null}
    </ListItemGroup>
  );
}

export default DeviceSectionAdvance;
