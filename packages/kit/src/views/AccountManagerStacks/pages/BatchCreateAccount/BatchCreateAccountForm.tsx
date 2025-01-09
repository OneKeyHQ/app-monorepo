import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountManagerStacksParamList } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import {
  BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT,
  BatchCreateAccountFormBase,
} from './BatchCreateAccountFormBase';
import { showBatchCreateAccountProcessingDialog } from './ProcessingDialog';

import type { IBatchCreateAccountFormValues } from './BatchCreateAccountFormBase';
import type { UseFormReturn } from 'react-hook-form';

function BatchCreateAccountFormPage({
  walletId,
  networkId,
}: {
  walletId: string;
  networkId: string | undefined;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();

  const intl = useIntl();

  const formRef = useRef<
    UseFormReturn<IBatchCreateAccountFormValues, any, undefined> | undefined
  >(undefined);

  const navigateToPreview = useCallback(
    async ({ replace }: { replace: boolean }) => {
      const values = formRef?.current?.getValues();
      if (!values) return;
      console.log(values);
      const actionType = replace ? 'replace' : 'push';
      navigation[actionType](
        EAccountManagerStacksRoutes.BatchCreateAccountPreview,
        {
          walletId,
          networkId: values.networkId,
          // from: values.from,
          // count: values.count,
        },
      );
    },
    [navigation, walletId],
  );

  const isProcessingRef = useRef(false);

  return (
    <Page scrollEnabled safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_bulk_add_accounts,
        })}
      />
      <Page.Body p="$4">
        <BatchCreateAccountFormBase
          alwaysShowAdvancedSettings
          // activeAccount?.network?.id ?? getNetworkIdsMap().onekeyall
          defaultNetworkId={networkId || getNetworkIdsMap().onekeyall}
          defaultDeriveType={undefined}
          defaultFrom="1"
          defaultCount={String(BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT)}
          onNetworkChanged={({ isAllNetwork }) => {
            if (!isAllNetwork) {
              void navigateToPreview({ replace: true });
            }
          }}
          formRef={formRef}
        />

        {process.env.NODE_ENV !== 'production' ? (
          <Stack mt="$8">
            <SizableText>walletId: {walletId}</SizableText>
            <SizableText>networkId: {activeAccount.network?.id}</SizableText>
            <SizableText>deriveType: {activeAccount.deriveType}</SizableText>
          </Stack>
        ) : null}
      </Page.Body>
      <Page.Footer
        // onConfirmText={intl.formatMessage({
        //   id: ETranslationsMock.batch_create_account_preview,
        // })}
        confirmButtonProps={{
          disabled: false,
        }}
        onConfirm={async () => {
          try {
            if (isProcessingRef.current) {
              console.error('batch create is processing, exit');
              return;
            }
            isProcessingRef.current = true;

            if (Object.keys(formRef?.current?.formState?.errors ?? {}).length) {
              isProcessingRef.current = false;
              return;
            }

            await formRef.current?.handleSubmit(async (values) => {
              const networkIdValue = values?.networkId;
              if (networkUtils.isAllNetwork({ networkId: networkIdValue })) {
                await backgroundApiProxy.servicePassword.promptPasswordVerifyByWallet(
                  {
                    walletId,
                    reason: EReasonForNeedPassword.CreateOrRemoveWallet,
                  },
                );

                const from = values?.from ?? '1';
                const count =
                  values?.count ??
                  String(BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT);
                const fromInt = parseInt(from, 10);
                const countInt = parseInt(count, 10);
                const beginIndex = fromInt - 1;
                const endIndex = beginIndex + countInt - 1;

                showBatchCreateAccountProcessingDialog({
                  navigation,
                  allNetworkInfo: {
                    count: countInt,
                  },
                });
                await timerUtils.wait(600);

                await backgroundApiProxy.serviceBatchCreateAccount.startBatchCreateAccountsFlowForAllNetwork(
                  {
                    walletId,
                    fromIndex: beginIndex,
                    toIndex: endIndex,
                    excludedIndexes: {},
                    saveToDb: true,
                    hideCheckingDeviceLoading: true,
                    autoHandleExitError: true,
                  },
                );
              } else {
                await navigateToPreview({ replace: false });
              }
            })();
          } finally {
            isProcessingRef.current = false;
          }
        }}
      />
    </Page>
  );
}

export default function BatchCreateAccountForm({
  route,
}: IPageScreenProps<
  IAccountManagerStacksParamList,
  EAccountManagerStacksRoutes.BatchCreateAccountForm
>) {
  const { walletId, networkId } = route.params ?? {};
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <BatchCreateAccountFormPage walletId={walletId} networkId={networkId} />
    </AccountSelectorProviderMirror>
  );
}
