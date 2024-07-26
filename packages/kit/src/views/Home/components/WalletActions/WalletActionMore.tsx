import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, useClipboard } from '@onekeyhq/components';
import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { openExplorerAddressUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { useSupportNetworkId } from '@onekeyhq/kit/src/views/FiatCrypto/hooks';
import { useWalletAddress } from '@onekeyhq/kit/src/views/WalletAddress/hooks/useWalletAddress';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalFiatCryptoRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import { RawActions } from './RawActions';

export function WalletActionMore() {
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, network, wallet, deriveInfo, deriveType } = activeAccount;
  const intl = useIntl();
  const { copyText } = useClipboard();
  const navigation = useAppNavigation();
  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveInfo,
    deriveType,
  });
  const { isEnable: walletAddressEnable, handleWalletAddress } =
    useWalletAddress({ activeAccount });
  const { result: isSupported } = useSupportNetworkId('sell', network?.id);

  const isSellDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }

    if (!isSupported) {
      return true;
    }

    return false;
  }, [isSupported, wallet?.type]);

  const handleCopyAddress = useCallback(() => {
    if (walletAddressEnable) {
      handleWalletAddress();
    } else if (wallet?.type === WALLET_TYPE_HW) {
      handleOnReceive();
    } else {
      copyText(account?.address || '');
    }
  }, [
    account?.address,
    copyText,
    handleOnReceive,
    wallet?.type,
    walletAddressEnable,
    handleWalletAddress,
  ]);

  const sellCrypto = useCallback(() => {
    navigation.pushModal(EModalRoutes.FiatCryptoModal, {
      screen: EModalFiatCryptoRoutes.SellModal,
      params: { networkId: network?.id ?? '', accountId: account?.id ?? '' },
    });
  }, [navigation, network, account]);
  const show = useReviewControl();

  const vaultSettings = usePromiseResult(async () => {
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network?.id ?? '',
    });
    return settings;
  }, [network?.id]).result;

  const sections: ComponentProps<typeof RawActions.More>['sections'] = [];

  if (!vaultSettings?.copyAddressDisabled) {
    sections.unshift({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_copy_address }),
          icon: 'Copy1Outline',
          onPress: handleCopyAddress,
        },
      ],
    });
  }

  if (!vaultSettings?.hideBlockExplorer) {
    sections.unshift({
      items: [
        {
          label: intl.formatMessage({
            id: ETranslations.global_view_in_blockchain_explorer,
          }),
          icon: 'GlobusOutline',
          onPress: () =>
            openExplorerAddressUrl({
              networkId: network?.id,
              address: account?.address,
            }),
        },
      ],
    });
  }

  if (show) {
    sections.unshift({
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_sell }),
          icon: 'MinusLargeOutline',
          disabled: Boolean(isSellDisabled && account?.id && network?.id),
          onPress: sellCrypto,
        },
      ],
    });
  }

  if (devSettings?.settings?.showDevExportPrivateKey) {
    const exportAccountCredentialKey = async ({
      keyType,
    }: {
      keyType: ECoreApiExportedSecretKeyType;
    }) => {
      console.log('ExportSecretKeys >>>> ', keyType);
      let r: string | undefined = '';
      if (
        keyType === ECoreApiExportedSecretKeyType.xpub ||
        keyType === ECoreApiExportedSecretKeyType.publicKey
      ) {
        r = await backgroundApiProxy.serviceAccount.exportAccountPublicKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      } else {
        r = await backgroundApiProxy.serviceAccount.exportAccountSecretKey({
          accountId: account?.id || '',
          networkId: network?.id || '',
          keyType,
        });
      }
      console.log('ExportSecretKeys >>>> ', r);
      console.log(
        'ExportSecretKeys >>>> ',
        wallet?.type,
        keyType,
        account?.address,
      );
      Dialog.show({
        title: 'Key',
        description: r,
        onConfirmText: 'Copy',
        onConfirm() {
          copyText(r || '');
        },
      });
    };
    sections.unshift({
      items: [
        {
          label: 'Export Public Key',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.publicKey,
            });
          },
        },
        {
          label: 'Export xpub',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.xpub,
            });
          },
        },
        {
          label: 'Export Private Key',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.privateKey,
            });
          },
        },
        {
          label: 'Export xprvt',
          icon: 'MinusLargeOutline',
          onPress: () => {
            void exportAccountCredentialKey({
              keyType: ECoreApiExportedSecretKeyType.xprvt,
            });
          },
        },
      ],
    });
  }

  return <RawActions.More sections={sections} />;
}
