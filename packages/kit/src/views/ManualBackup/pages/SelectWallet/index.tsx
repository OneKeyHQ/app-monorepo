import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Page, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletListView } from '@onekeyhq/kit/src/components/WalletListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

export default function ManualBackupSelectWalletPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const walletList = usePromiseResult(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets();
    const hdWalletList = wallets.filter((wallet) =>
      accountUtils.isHdWallet({ walletId: wallet.id }),
    );
    return hdWalletList;
  }, []).result;

  const onPick = useCallback(
    async (item: IDBWallet) => {
      const { mnemonic } =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId: item.id,
          reason: EReasonForNeedPassword.Security,
        });
      navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase, {
        mnemonic,
        isBackup: true,
        isWalletBackedUp: item.backuped,
        walletId: item.id,
      });
    },
    [navigation],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_select_wallet,
        })}
      />
      <Page.Body>
        <WalletListView
          walletList={walletList}
          onPick={onPick}
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title={intl.formatMessage({
                id: ETranslations.backup_no_data,
              })}
              description={intl.formatMessage({
                id: ETranslations.backup_no_content_available_for_backup,
              })}
            />
          }
          ListFooterComponent={
            walletList?.length ? (
              <SizableText size="$bodySm" color="$textSubdued" px="$5" mt="$5">
                {intl.formatMessage({
                  id: ETranslations.settings_hardware_wallets_not_appear,
                })}
              </SizableText>
            ) : null
          }
        />
      </Page.Body>
    </Page>
  );
}
