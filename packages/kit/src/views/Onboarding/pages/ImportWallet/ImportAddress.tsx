import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useImportAddressForm } from './hooks/useImportAddressForm';
import { ImportAddressCore } from './ImportAddressCore';

function ImportAddress() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleWalletAdded = () => {
    if (platformEnv.isWebDappMode) {
      navigation.navigate(ERootRoutes.Main, undefined, {
        pop: true,
      });
    } else {
      navigation.popStack();
    }
  };

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
  } = useImportAddressForm({ onWalletAdded: handleWalletAdded });

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_import_address })}
      />
      <Page.Body px="$5">
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
      </Page.Body>
      <Page.Footer
        confirmButtonProps={{
          disabled: !isEnable,
        }}
        onConfirm={form.submit}
      />
    </Page>
  );
}

function ImportAddressPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ImportAddress />
    </AccountSelectorProviderMirror>
  );
}

export default ImportAddressPage;
