import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Icon, Page, Progress, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAccountManagerStacksRoutes,
  IAccountManagerStacksParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

function BatchCreateAccountProcessingPage({
  walletId,
  networkId,
  from,
  count,
}: {
  walletId: string;
  networkId: string;
  from: string;
  count: string;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const intl = useIntl();
  const navigation = useAppNavigation();

  const [state, setState] = useState<
    IAppEventBusPayload[EAppEventBusNames.BatchCreateAccount] | undefined
  >(undefined);

  const isDone = useMemo(
    () => state && state?.progressCurrent === state?.progressTotal,
    [state],
  );

  useEffect(() => {
    const cb = (
      payload: IAppEventBusPayload[EAppEventBusNames.BatchCreateAccount],
    ) => {
      setState(payload);
    };
    appEventBus.on(EAppEventBusNames.BatchCreateAccount, cb);

    return () => {
      appEventBus.off(EAppEventBusNames.BatchCreateAccount, cb);
    };
  }, []);

  const progressBarView = useMemo(
    () => (
      <>
        <SizableText mb="$4">Adding Accounts</SizableText>
        <Progress
          w="100%"
          size="medium"
          value={Math.ceil(
            ((state?.progressCurrent ?? 0) / (state?.progressTotal ?? 1)) * 100,
          )}
        />
        <SizableText mt="$5" size="$bodyLg" textAlign="center">
          {state?.createdCount ?? 0}:::
          {intl.formatMessage(
            {
              id: ETranslationsMock.batch_create_account_preview_added,
            },
            {
              count: state?.createdCount ?? 0,
            },
          )}
        </SizableText>
      </>
    ),
    [intl, state?.createdCount, state?.progressCurrent, state?.progressTotal],
  );

  const doneView = useMemo(
    () => (
      <>
        <Icon
          name="CheckRadioSolid"
          size="$24"
          $gtMd={{
            size: '$20',
          }}
          color="$iconSuccess"
        />
        <SizableText mt="$5" size="$bodyLg" textAlign="center">
          {state?.createdCount ?? 0}:::
          {intl.formatMessage(
            {
              id: ETranslationsMock.batch_create_account_done_added,
            },
            {
              count: state?.createdCount ?? 0,
            },
          )}
        </SizableText>
        <SizableText>
          {state?.createdCount} / {state?.totalCount}
        </SizableText>
      </>
    ),
    [intl, state?.createdCount, state?.totalCount],
  );

  return (
    <Page scrollEnabled={false} safeAreaEnabled={false}>
      <Page.Header disableClose dismissOnOverlayPress={false} />
      <Page.Body
        py="$2.5"
        px="$5"
        space="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          alignSelf="center"
          w="100%"
          maxWidth="$80"
        >
          {isDone ? doneView : progressBarView}

          {platformEnv.isDev ? (
            <SizableText>
              DebugProgress: {state?.progressCurrent} / {state?.progressTotal}
            </SizableText>
          ) : null}
        </Stack>
      </Page.Body>
      <Page.Footer
        cancelButton={
          !isDone ? (
            <Page.CancelButton
              onCancel={async () => {
                await backgroundApiProxy.serviceCreateBatchAccount.cancelBatchCreateAccountsFlow();
                navigation.pop();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_cancel })}
            </Page.CancelButton>
          ) : undefined
        }
        confirmButton={
          isDone ? (
            <Page.ConfirmButton
              onConfirm={() => {
                //
                navigation.popStack();
              }}
            >
              {intl.formatMessage({ id: ETranslations.global_done })}
            </Page.ConfirmButton>
          ) : undefined
        }
      />
    </Page>
  );
}

export default function BatchCreateAccountProcessing({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.BatchCreateAccountPreview
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <BatchCreateAccountProcessingPage {...route.params} />
    </AccountSelectorProviderMirror>
  );
}
