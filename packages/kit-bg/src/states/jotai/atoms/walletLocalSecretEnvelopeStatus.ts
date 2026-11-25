import type { ILocalSecretEnvelopeCredentialIssue } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

type IWalletLocalSecretEnvelopeStatus = {
  sessionId: string;
  issues: Record<string, ILocalSecretEnvelopeCredentialIssue>;
};

export const {
  target: walletLocalSecretEnvelopeStatusAtom,
  use: useWalletLocalSecretEnvelopeStatusAtom,
} = globalAtom<IWalletLocalSecretEnvelopeStatus>({
  name: EAtomNames.walletLocalSecretEnvelopeStatusAtom,
  persist: false,
  initialValue: { sessionId: '', issues: {} },
});
