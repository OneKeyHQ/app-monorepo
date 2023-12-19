import { isEqual } from 'lodash';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { PhaseInputArea } from '../../Components/PhaseInputArea';
import { EOnboardingPages } from '../../router/type';

import type { IOnboardingParamList } from '../../router/type';

export function VerifyRecoveryPhrase({
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.VerifyRecoverPhrase
>) {
  const { phrases } = route.params || {};
  const navigation = useAppNavigation();
  const handleConfirmPress = (values: string[]) => {
    if (isEqual(phrases, values)) {
      navigation.push(EOnboardingPages.FinalizeWalletSetup);
    } else {
      alert('not equal');
    }
  };

  return (
    <Page>
      <Page.Header title="Verify your Recovery Phrase" />
      <PhaseInputArea onConfirm={handleConfirmPress} />
    </Page>
  );
}
