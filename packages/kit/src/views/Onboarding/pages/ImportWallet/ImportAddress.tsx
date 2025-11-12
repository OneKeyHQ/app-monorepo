import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useImportAddressForm } from './hooks/useImportAddressForm';
import { ImportAddressCore } from './ImportAddressCore';

function ImportAddress() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useAppRoute<
    IOnboardingParamList,
    EOnboardingPages.ImportAddress
  >();
  const isFromOnboardingV2 = route.params?.isFromOnboardingV2;

  const handleWalletAdded = () => {
    if (platformEnv.isWebDappMode) {
      navigation.navigate(ERootRoutes.Main, undefined, {
        pop: true,
      });
    } else {
      navigation.popStack();
      if (isFromOnboardingV2) {
        navigation.navigate(ERootRoutes.Main, undefined, {
          pop: true,
        });
      }
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
          isFromOnboardingV2={isFromOnboardingV2}
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
