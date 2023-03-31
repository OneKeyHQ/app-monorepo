import { formatMessage } from '@onekeyhq/components/src/Provider';
import { AccountCredentialType } from '@onekeyhq/engine/src/types/account';

import type { IAccountInfoListItem } from '.';

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
  ManageAccountKeys.ExportPrivateSpendKey,
  ManageAccountKeys.ExportPrivateViewKey,
  ManageAccountKeys.ExportSecretMnemonic,
];

export const manageAccountOptions: Record<
  ManageAccountKeys,
  IAccountInfoListItem
> = {
  [ManageAccountKeys.Name]: {
    label: formatMessage({ id: 'form__name' }),
    key: ManageAccountKeys.Name,
  },
  [ManageAccountKeys.ExportPublicKey]: {
    label: formatMessage({ id: 'form__export_public_key' }),
    key: ManageAccountKeys.ExportPublicKey,
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_see_your_entire_transaction_history',
    }),
  },
  [ManageAccountKeys.HardwareCanNotExportPrivateKey]: {
    key: ManageAccountKeys.HardwareCanNotExportPrivateKey,
  },
  [ManageAccountKeys.ExportPrivateKey]: {
    label: formatMessage({ id: 'action__export_private_key' }),
    key: ManageAccountKeys.ExportPrivateKey,
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    credentialInfo: {
      type: AccountCredentialType.PrivateKey,
      key: 'action__export_private_key',
    },
  },
  [ManageAccountKeys.ExportPrivateViewKey]: {
    label: formatMessage({ id: 'action__export_view_key' }),
    key: ManageAccountKeys.ExportPrivateViewKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateViewKey,
      key: 'action__export_view_key',
    },
  },
  [ManageAccountKeys.ExportPrivateSpendKey]: {
    label: formatMessage({ id: 'action__export_spend_key' }),
    key: ManageAccountKeys.ExportPrivateSpendKey,
    credentialInfo: {
      type: AccountCredentialType.PrivateSpendKey,
      key: 'action__export_spend_key',
    },
  },
  [ManageAccountKeys.ExportSecretMnemonic]: {
    label: formatMessage({ id: 'action__export_secret_mnemonic' }),
    description: formatMessage({
      id: 'msg__once_exposed_a_third_party_will_be_able_to_take_full_control_of_your_account',
    }),
    key: ManageAccountKeys.ExportSecretMnemonic,
    credentialInfo: {
      type: AccountCredentialType.Mnemonic,
      key: 'action__export_secret_mnemonic',
    },
  },
  [ManageAccountKeys.RemoveAccount]: {
    label: formatMessage({ id: 'action__remove_account' }),
    key: ManageAccountKeys.RemoveAccount,
  },
};
