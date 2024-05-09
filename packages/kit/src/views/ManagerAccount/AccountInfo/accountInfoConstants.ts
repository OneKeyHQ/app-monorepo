import { AccountCredentialType } from '@onekeyhq/engine/src/types/account';

import type { IAccountInfoListItem } from '.';
import type { IntlShape } from 'react-intl';

export enum ManageAccountKeys {
  Name = 'Name',
  ExportPublicKey = 'ExportPublicKey',
  ExportPrivateKey = 'ExportPrivateKey',
  ExportSecretMnemonic = 'ExportSecretMnemonic',
  ExportPrivateViewKey = 'ExportPrivateViewKey',
  ExportPrivateSpendKey = 'ExportPrivateSpendKey',
  HardwareCanNotExportPrivateKey = 'HardwareCanNotExportPrivateKey',
  RemoveAccount = 'RemoveAccount',
}

export const SpecialExportCredentialKeys = [
  ManageAccountKeys.ExportPrivateViewKey,
  ManageAccountKeys.ExportPrivateSpendKey,
  ManageAccountKeys.ExportSecretMnemonic,
];

export const getManageAccountOptions: (
  intl: IntlShape,
) => Record<ManageAccountKeys, IAccountInfoListItem> = (intl) => ({
  [ManageAccountKeys.Name]: {
    label: intl.formatMessage({ id: 'form__name' }),
    key: ManageAccountKeys.Name,
  },
  [ManageAccountKeys.ExportPublicKey]: {
    label: intl.formatMessage({ id: 'form__export_public_key' }),
    key: ManageAccountKeys.ExportPublicKey,
    description: intl.formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_see_your_entire_transaction_history',
    }),
  },
  [ManageAccountKeys.HardwareCanNotExportPrivateKey]: {
    key: ManageAccountKeys.HardwareCanNotExportPrivateKey,
  },
  [ManageAccountKeys.ExportPrivateKey]: {
    label: intl.formatMessage({ id: 'action__export_private_key' }),
    key: ManageAccountKeys.ExportPrivateKey,
    description: intl.formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    credentialInfo: {
      type: AccountCredentialType.PrivateKey,
      key: 'action__export_private_key',
    },
  },

  [ManageAccountKeys.ExportPrivateViewKey]: {
    label: intl.formatMessage({ id: 'action__export_private_view_key' }),
    description: intl.formatMessage({
      id: 'action__export_private_view_key_desc',
    }),
    key: ManageAccountKeys.ExportPrivateViewKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateViewKey,
      key: 'action__export_view_key',
    },
  },
  [ManageAccountKeys.ExportPrivateSpendKey]: {
    label: intl.formatMessage({ id: 'action__export_private_spend_key' }),
    description: intl.formatMessage({
      id: 'action__export_private_spend_key_desc',
    }),
    key: ManageAccountKeys.ExportPrivateSpendKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateSpendKey,
      key: 'action__export_spend_key',
    },
  },
  [ManageAccountKeys.ExportSecretMnemonic]: {
    label: intl.formatMessage({ id: 'action__export_secret_mnemonic' }),
    description: intl.formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    key: ManageAccountKeys.ExportSecretMnemonic,
    credentialInfo: {
      type: AccountCredentialType.Mnemonic,
      key: 'action__export_secret_mnemonic',
    },
  },
  [ManageAccountKeys.RemoveAccount]: {
    label: intl.formatMessage({ id: 'action__remove_account' }),
    key: ManageAccountKeys.RemoveAccount,
  },
});
