import { useIntl } from 'react-intl';

import { Button, Stack } from '@onekeyhq/components';
import { useImportAddressForm } from '@onekeyhq/kit/src/views/Onboarding/pages/ImportWallet/hooks/useImportAddressForm';
import { ImportAddressCore } from '@onekeyhq/kit/src/views/Onboarding/pages/ImportWallet/ImportAddressCore';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../AccountSelector';

interface IWatchOnlyWalletContentProps {
  onWalletAdded?: () => void;
}

function WatchOnlyWallet({ onWalletAdded }: IWatchOnlyWalletContentProps) {
  const intl = useIntl();
  const {
    form,
    isEnable,
    method,
    setMethod,
    networksResp,
    isKeyExportEnabled,
    isPublicKeyImport,
    validateResult,
    inputTextDebounced,
    networkIdText,
    deriveTypeValue,
  } = useImportAddressForm({ onWalletAdded });

  return (
    <Stack flex={1} p="$5" gap="$4">
      <ImportAddressCore
        form={form}
        method={method}
        setMethod={setMethod}
        networksResp={networksResp}
        isKeyExportEnabled={isKeyExportEnabled}
        isPublicKeyImport={isPublicKeyImport}
        validateResult={validateResult}
        inputTextDebounced={inputTextDebounced}
        networkIdText={networkIdText}
        deriveTypeValue={deriveTypeValue}
      />
      <Button variant="primary" disabled={!isEnable} onPress={form.submit}>
        {intl.formatMessage({ id: ETranslations.global_import })}
      </Button>
    </Stack>
  );
}

function WatchOnlyWalletContent({
  onWalletAdded,
}: IWatchOnlyWalletContentProps) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <WatchOnlyWallet onWalletAdded={onWalletAdded} />
    </AccountSelectorProviderMirror>
  );
}

export { WatchOnlyWalletContent };
