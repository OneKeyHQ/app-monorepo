import type { UseFormReturn } from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';
import type {
  EImportMethod,
  IFormValues,
} from '@onekeyhq/kit/src/views/Onboarding/pages/ImportWallet/hooks/useImportAddressForm';
import { ImportAddressCore } from '@onekeyhq/kit/src/views/Onboarding/pages/ImportWallet/ImportAddressCore';
import type { IAccountDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';

interface IWatchOnlyWalletContentProps {
  form: UseFormReturn<IFormValues>;
  isEnable: boolean;
  method: EImportMethod;
  setMethod: (method: EImportMethod) => void;
  networksResp: {
    networkIds: string[];
    publicKeyExportEnabled: Set<string>;
    watchingAccountEnabled: Set<string>;
  };
  isKeyExportEnabled: boolean;
  isPublicKeyImport: boolean;
  validateResult?: {
    isValid: boolean;
    deriveInfoItems?: IAccountDeriveInfo[];
  };
  inputTextDebounced: string;
  networkIdText?: string;
  deriveTypeValue?: any;
}

function WatchOnlyWalletContent({
  form,
  method,
  setMethod,
  networksResp,
  isKeyExportEnabled,
  isPublicKeyImport,
  validateResult,
  inputTextDebounced,
  networkIdText,
  deriveTypeValue,
}: IWatchOnlyWalletContentProps) {
  return (
    <Stack flex={1} p="$5">
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
    </Stack>
  );
}

export { WatchOnlyWalletContent };
