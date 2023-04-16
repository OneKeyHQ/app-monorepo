import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { useNetwork } from '../../../hooks';

import {
  ManageAccountKeys,
  SpecialExportCredentialKeys,
  getManageAccountOptions,
} from './accountInfoConstants';

import type { IAccountInfoListSectionData } from '.';

export function useAccountInfoDataSource({
  wallet,
  networkId,
}: {
  wallet?: Wallet;
  networkId: string;
}) {
  const intl = useIntl();
  const { network } = useNetwork({ networkId });
  const manageAccountOptions = useMemo(
    () => getManageAccountOptions(intl),
    [intl],
  );
  const [dataSource, setDataSource] = useState<IAccountInfoListSectionData[]>([
    {
      title: intl.formatMessage({ id: 'content__info' }),
      data: [manageAccountOptions[ManageAccountKeys.Name]],
    },
  ]);

  useEffect(() => {
    const keys: ManageAccountKeys[] = [];
    if (network && wallet) {
      const {
        exportCredentialInfo,
        privateKeyExportEnabled,
        publicKeyExportEnabled,
      } = network.settings;
      if (publicKeyExportEnabled) {
        keys.push(ManageAccountKeys.ExportPublicKey);
      }
      if (
        privateKeyExportEnabled &&
        (wallet.type === 'hd' || wallet.type === 'imported')
      ) {
        if (exportCredentialInfo) {
          SpecialExportCredentialKeys.forEach((key) => {
            const option = manageAccountOptions[key];
            if (
              exportCredentialInfo.some(
                (info) => info.type === option.credentialInfo?.type,
              )
            ) {
              keys.push(key);
            }
          });
        } else {
          keys.push(ManageAccountKeys.ExportPrivateKey);
        }
      }
      if (wallet.type === 'hw') {
        keys.push(ManageAccountKeys.HardwareCanNotExportPrivateKey);
      }
      keys.push(ManageAccountKeys.RemoveAccount);
      setDataSource((prev) => [
        ...prev,
        {
          title: intl.formatMessage({ id: 'form__security_uppercase' }),
          data: keys.map((key) => manageAccountOptions[key]),
        },
      ]);
    }
  }, [network, wallet, intl, manageAccountOptions]);

  return { dataSource };
}
