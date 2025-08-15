import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast, useClipboard } from '@onekeyhq/components';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
        const [account, network] = await Promise.all([
          backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          }),
          backgroundApiProxy.serviceNetwork.getNetworkSafe({
            networkId,
          }),
        ]);
        if (
          networkUtils
            .getDefaultDeriveTypeVisibleNetworks()
            .includes(networkId) &&
          deriveInfo
        ) {
          copyText(account.address, undefined, false);
          Toast.success({
            title: intl.formatMessage(
              {
                id: ETranslations.address_copied_with_type_toast_title,
              },
              {
                network: network?.shortname ?? '',
                addressType: deriveInfo.labelKey
                  ? intl.formatMessage({
                      id: deriveInfo.labelKey,
                    })
                  : deriveInfo.label ?? '',
              },
            ),
            message: account.address,
          });
        } else {
          copyText(account.address, undefined, false);
          Toast.success({
            title: intl.formatMessage(
              {
                id: ETranslations.address_copied_toast_title,
              },
              {
                network: network?.shortname ?? '',
              },
            ),
            message: account.address,
          });
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
      networkName,
    }: {
      address: string;
      deriveInfo?: IAccountDeriveInfo;
      networkName?: string;
    }) => {
      copyText(address, undefined, false);

      if (deriveInfo) {
        Toast.success({
          title: intl.formatMessage(
            {
              id: ETranslations.address_copied_with_type_toast_title,
            },
            {
              network: networkName ?? '',
              addressType: deriveInfo.labelKey
                ? intl.formatMessage({
                    id: deriveInfo.labelKey,
                  })
                : deriveInfo.label ?? '',
            },
          ),
          message: address,
        });
      } else {
        Toast.success({
          title: intl.formatMessage(
            {
              id: ETranslations.address_copied_toast_title,
            },
            {
              network: networkName ?? '',
            },
          ),
          message: address,
        });
      }
    },
    [copyText, intl],
  );
};
