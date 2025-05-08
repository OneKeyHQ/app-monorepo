import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';

import { Button, IconButton, Stack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useManageToken } from '../../../hooks/useManageToken';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TabSettings() {
  const { md } = useMedia();
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });
  return manageTokenEnabled ? (
    <>
      {md ? (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.manage_token_custom_token_title,
          })}
          variant="tertiary"
          icon="SliderHorOutline"
          onPress={handleOnManageToken}
        />
      ) : (
        <Button
          icon="SliderHorOutline"
          size="small"
          variant="tertiary"
          onPress={handleOnManageToken}
        >
          {intl.formatMessage({
            id: ETranslations.global_manage,
          })}
        </Button>
      )}
    </>
  ) : null;
}

function Container({ children }: PropsWithChildren) {
  return platformEnv.isNativeIOS ? (
    <Stack position="absolute" top="$3" right="$5">
      {children}
    </Stack>
  ) : (
    children
  );
}

export function TabHeaderSettings() {
  return (
    <Container>
      <TabSettings />
    </Container>
  );
}
