import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Checkbox, IconButton, Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalKeyTagParamList } from '@onekeyhq/shared/src/routes';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

const BackupDotMap = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalKeyTagParamList, EModalKeyTagRoutes.BackupDotMap>
    >();

  useEffect(() => {
    defaultLogger.setting.page.keyTagBackup();
  }, []);

  const [continueOperate, setContinueOperate] = useState(false);

  const { encodedText, title, wallet } = route.params;
  const { result } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePassword.decodeSensitiveText({ encodedText }),
    [encodedText],
  );
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(
    () => (
      <IconButton
        icon="QuestionmarkOutline"
        variant="tertiary"
        onPress={() => {
          appNavigation.push(EModalKeyTagRoutes.BackupDocs);
        }}
      />
    ),
    [appNavigation],
  );

  return (
    <Page scrollEnabled>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body>
        <YStack alignItems="center">
          {result ? <DotMap mnemonic={result} /> : null}
        </YStack>
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_i_got_it,
          })}
          confirmButtonProps={{
            disabled: !continueOperate,
            variant: 'primary',
            onPress: async () => {
              if (wallet?.id && !wallet.backuped) {
                await backgroundApiProxy.serviceAccount.updateWalletBackupStatus(
                  {
                    walletId: wallet.id,
                    isBackedUp: true,
                  },
                );
                appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
              }
              appNavigation.popStack();
            },
          }}
        >
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.wallet_backup_backup_confirmation,
            })}
            value={continueOperate}
            onChange={(checked) => {
              setContinueOperate(!!checked);
            }}
          />
        </Page.FooterActions>
      </Page.Footer>
    </Page>
  );
};

export default BackupDotMap;
