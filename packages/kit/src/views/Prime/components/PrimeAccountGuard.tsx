import type { ComponentType, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  SizableText,
  YStack,
  resetPrimeModal,
} from '@onekeyhq/components';
import { useConfirmOneKeyIdLogout } from '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { primeUserBannedMessage } from '@onekeyhq/shared/src/prime/primeUserBanned';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

function PrimeBannedAccount() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const logout = useConfirmOneKeyIdLogout({
    reason: 'Banned OneKey ID logout',
    onSuccess: resetPrimeModal,
  });

  return (
    <Page>
      <Page.Header title="OneKey ID" />
      <Page.Body>
        <YStack p="$5" gap="$5">
          <SizableText>
            {intl.formatMessage(primeUserBannedMessage)}
          </SizableText>
          <Button
            testID="prime-banned-delete-account-btn"
            variant="destructive"
            onPress={() => navigation.push(EPrimePages.PrimeDeleteAccount)}
          >
            {intl.formatMessage({ id: ETranslations.id_delete_onekey_id })}
          </Button>
          <Button
            testID="prime-banned-logout-btn"
            variant="tertiary"
            onPress={logout}
          >
            {intl.formatMessage({ id: ETranslations.prime_log_out })}
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export function PrimeAccountGuard({ children }: { children: ReactNode }) {
  const [user] = usePrimePersistAtom();
  return user.isOneKeyIdBanned ? <PrimeBannedAccount /> : children;
}

export function withPrimeAccountGuard<P extends object>(
  Component: ComponentType<P>,
) {
  return function GuardedPrimePage(props: P) {
    return (
      <PrimeAccountGuard>
        <Component {...props} />
      </PrimeAccountGuard>
    );
  };
}
