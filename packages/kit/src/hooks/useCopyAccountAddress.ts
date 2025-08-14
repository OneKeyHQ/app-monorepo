import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast, useClipboard } from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EModalReceiveRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';

export const useCopyAccountAddress = () => {
  const appNavigation = useAppNavigation();
  const { copyText } = useClipboard();
  const intl = useIntl();
  return useCallback(
    async ({
      accountId,
      networkId,
      token,
      deriveInfo,
      onDeriveTypeChange,
    }: {
      accountId: string;
      networkId: string;
      token?: IToken;
      deriveInfo?: IAccountDeriveInfo;
      onDeriveTypeChange?: (deriveType: IAccountDeriveTypes) => void;
    }) => {
      if (
        accountUtils.isHwAccount({ accountId }) ||
        accountUtils.isQrAccount({ accountId })
      ) {
        const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
        appNavigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveToken,
          params: {
            networkId,
            accountId,
            walletId,
            token,
            onDeriveTypeChange,
          },
        });
      } else {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        if (
          networkUtils
            .getDefaultDeriveTypeVisibleNetworks()
            .includes(networkId) &&
          deriveInfo
        ) {
          copyText(account.address);
          Toast.success({
            title: `${
              deriveInfo.labelKey
                ? intl.formatMessage({
                    id: deriveInfo.labelKey,
                  })
                : deriveInfo.label ?? ''
            } address copied`,
          });
        } else {
          copyText(account.address);
        }
      }
    },
    [appNavigation, copyText, intl],
  );
};

export const useCopyAddressWithDeriveType = () => {
  const { copyText } = useClipboard();
  const intl = useIntl();
  return useCallback(
    ({
      address,
      deriveInfo,
    }: {
      address: string;
      deriveInfo?: IAccountDeriveInfo;
    }) => {
      copyText(address);

      if (deriveInfo) {
        Toast.success({
          title: `${
            deriveInfo.labelKey
              ? intl.formatMessage({
                  id: deriveInfo.labelKey,
                })
              : deriveInfo.label ?? ''
          } address copied`,
        });
      }
    },
    [copyText, intl],
  );
};
