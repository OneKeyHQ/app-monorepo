import { isEqual } from 'lodash';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, Toast } from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { PhaseInputArea } from '../../components/PhaseInputArea';
import { EOnboardingPages } from '../../router/type';

import type { IOnboardingParamList } from '../../router/type';

const tutorials = [
  {
    title: "Why can't I type full words?",
    description:
      'Full word typing is off to block keyloggers. Pick words from our suggestions to ensure your recovery phrase stays secure.',
  },
];
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
          tutorials={tutorials}
        />
      ) : null}
    </Page>
  );
}

export default VerifyRecoveryPhrase;
