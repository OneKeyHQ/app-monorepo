import { isEqual } from 'lodash';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, Toast } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { PhaseInputArea } from '../../components/PhaseInputArea';

export function VerifyRecoveryPhrase({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.VerifyRecoverPhrase
>) {
  const { servicePassword } = backgroundApiProxy;
  const { mnemonic } = route.params || {};
  ensureSensitiveTextEncoded(mnemonic);
  const navigation = useAppNavigation();
  const handleConfirmPress = async (mnemonicConfirm: string) => {
    if (
      isEqual(
        await servicePassword.decodeSensitiveText({
          encodedText: mnemonic,
        }),
        await servicePassword.decodeSensitiveText({
          encodedText: mnemonicConfirm,
        }),
      )
    ) {
      navigation.push(EOnboardingPages.FinalizeWalletSetup, {
        mnemonic: mnemonicConfirm,
      });
    } else {
      Toast.error({
        title: 'not equal',
      });
    }
  };

  const { result: phrases } = usePromiseResult(async () => {
    if (process.env.NODE_ENV !== 'production') {
      const mnemonicRaw = await servicePassword.decodeSensitiveText({
        encodedText: mnemonic,
      });
      return mnemonicRaw.split(' ');
    }
    return [];
  }, [mnemonic, servicePassword]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Verify your Recovery Phrase" />
      {phrases ? (
        <PhaseInputArea
          defaultPhrases={[]}
          onConfirm={handleConfirmPress}
          showPhraseLengthSelector={false}
          showClearAllButton={false}
          tutorials={[
            {
              title: "Why can't I type full words?",
              description:
                'To prevent keylogger attacks. Use suggested words for security.',
            },
            {
              title: "Why can't I paste directly?",
              description:
                "Pasting sensitive information is discouraged due to potential clipboard data breaches, which could risk asset loss. We'll enable pasting in specific, secure scenarios as identified.",
            },
          ]}
        />
      ) : null}
    </Page>
  );
}

export default VerifyRecoveryPhrase;
