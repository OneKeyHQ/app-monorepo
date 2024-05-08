import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { IMPL_DYNEX } from '@onekeyhq/shared/src/engine/engineConsts';

import { useAccount, useNetwork } from '../../../hooks';

import {
  ManageAccountKeys,
  SpecialExportCredentialKeys,
  getManageAccountOptions,
} from './accountInfoConstants';

import type { IAccountInfoListSectionData } from '.';

export function useAccountInfoDataSource({
  wallet,
  networkId,
  accountId,
}: {
  wallet?: Wallet;
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({ networkId, accountId });
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
      if (publicKeyExportEnabled && account?.xpub) {
        keys.push(ManageAccountKeys.ExportPublicKey);
      }
      if (
        privateKeyExportEnabled &&
        (wallet.type === 'hd' ||
          wallet.type === 'imported' ||
          (wallet.type === 'hw' && network.impl === IMPL_DYNEX))
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
      if (wallet.type === 'hw' && network.impl !== IMPL_DYNEX) {
        keys.push(ManageAccountKeys.HardwareCanNotExportPrivateKey);
      }
      keys.push(ManageAccountKeys.RemoveAccount);
      const title = intl.formatMessage({ id: 'form__security_uppercase' });
      const data = Array.from(
        new Set(keys.map((key) => manageAccountOptions[key])),
      );
      setDataSource((prev) => {
        const result = prev.filter((item) => item.title !== title);
        return [...result, { title, data }];
      });
    }
  }, [network, wallet, intl, manageAccountOptions, account?.xpub]);

  return { dataSource };
}
