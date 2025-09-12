import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Progress,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { setGlobalShowDeviceProgressDialogEnabled } from '@onekeyhq/kit/src/provider/Container/HardwareUiStateContainer/HardwareUiStateContainer';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IBatchCreateAccountAllNetworkInfo = {
  count: number;
};

function ProcessingDialogContent({
  navigation,
  allNetworkInfo,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
  renderProgressContent,
}: {
  navigation?: IAppNavigation;
  allNetworkInfo?: IBatchCreateAccountAllNetworkInfo;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
  renderProgressContent?: (props: {
    progressCurrent: number;
    progressTotal: number;
  }) => React.ReactNode;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();

  const [
    sdkGetAllNetworkAddressProcessing,
    setSdkGetAllNetworkAddressProcessing,
  ] = useState(false);

  const [state, setState] = useState<
    IAppEventBusPayload[EAppEventBusNames.BatchCreateAccount] | undefined
  >(undefined);

  const isDone = useMemo(
    () => Boolean(state && state?.progressCurrent === state?.progressTotal),
    [state],
  );
  const isError = useMemo(() => Boolean(state && !!state?.error), [state]);
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (closeAfterDone && isDone) {
      void dialogInstance.close();
    }
    if (closeAfterCancel && isCancelled) {
      void dialogInstance.close();
    }
    if (closeAfterError && isError) {
      void dialogInstance.close();
    }
  }, [
    closeAfterDone,
    isDone,
    dialogInstance,
    closeAfterCancel,
    isCancelled,
    closeAfterError,
    isError,
  ]);

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

  useEffect(() => {
    const cb = () => {
      setSdkGetAllNetworkAddressProcessing(true);
    };
    appEventBus.on(EAppEventBusNames.SDKGetAllNetworkAddressesStart, cb);
    return () => {
      appEventBus.off(EAppEventBusNames.SDKGetAllNetworkAddressesStart, cb);
    };
  }, []);

  useEffect(() => {
    const cb = () => {
      setSdkGetAllNetworkAddressProcessing(false);
    };
    appEventBus.on(EAppEventBusNames.SDKGetAllNetworkAddressesEnd, cb);
    return () => {
      appEventBus.off(EAppEventBusNames.SDKGetAllNetworkAddressesEnd, cb);
    };
  }, []);

  const shouldShowCheckingDeviceLoading = useMemo(
    () => sdkGetAllNetworkAddressProcessing && !state?.progressCurrent,
    [sdkGetAllNetworkAddressProcessing, state?.progressCurrent],
  );

  const isFlowEnded = isDone || isCancelled || isError;
  return (
    <Stack>
      <Stack
        py="$2.5"
        px="$5"
        gap="$5"
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
          {isDone && !isError && !isCancelled ? (
            <Icon name="CheckRadioSolid" size="$12" color="$iconSuccess" />
          ) : null}

          {(isCancelled || isError) && !isDone ? (
            <Icon name="XCircleSolid" size="$12" color="$iconCritical" />
          ) : null}

          {/* <SizableText mb="$4">Adding Accounts</SizableText> */}
          {!isFlowEnded ? (
            <Progress
              mt="$4"
              w="100%"
              size="medium"
              value={Math.ceil(
                ((state?.progressCurrent ?? 0) / (state?.progressTotal ?? 1)) *
                  100,
              )}
            />
          ) : null}

          <XStack mt="$5" alignItems="center" gap="$2">
            <SizableText size="$bodyLg" textAlign="center">
              {(() => {
                if (shouldShowCheckingDeviceLoading) {
                  return intl.formatMessage({
                    id: ETranslations.global_bulk_copy_addresses_checking_device_status,
                  });
                }
                if (renderProgressContent) {
                  return renderProgressContent({
                    progressCurrent: state?.progressCurrent ?? 0,
                    progressTotal: state?.progressTotal ?? 0,
                  });
                }
                return intl.formatMessage(
                  {
                    // "{amount} address(es) added",
                    id: ETranslations.global_bulk_accounts_loading,
                  },
                  {
                    // amount: state?.createdCount ?? 0,
                    amount: state?.progressCurrent ?? 0,
                  },
                );
              })()}
            </SizableText>
            {shouldShowCheckingDeviceLoading ? <Spinner size="small" /> : null}
          </XStack>

          {allNetworkInfo ? (
            <SizableText size="$bodyLg" textAlign="center">
              {intl.formatMessage(
                {
                  //  "({amount} accounts)",
                  id: ETranslations.global_bulk_accounts_loading_subtitle,
                },
                {
                  amount: allNetworkInfo.count ?? 0,
                },
              )}
            </SizableText>
          ) : null}

          {platformEnv.isDev ? (
            <SizableText>
              DebugProgress: {state?.progressCurrent} / {state?.progressTotal} :
              {state?.createdCount} / {state?.totalCount} : ${state?.networkId}{' '}
              - ${state?.deriveType}
            </SizableText>
          ) : null}
        </Stack>
      </Stack>

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton
        confirmButtonProps={{
          variant: isFlowEnded ? 'primary' : 'secondary',
          testID: 'process-dialog-confirm-button',
        }}
        onConfirmText={
          isFlowEnded
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_cancel })
        }
        onConfirm={
          isFlowEnded
            ? async () => {
                if (!isCancelled) {
                  navigation?.popStack();
                }
                await backgroundApiProxy.serviceBatchCreateAccount.cancelBatchCreateAccountsFlow();
              }
            : async ({ preventClose }) => {
                preventClose();
                setIsCancelled(true);
                await backgroundApiProxy.serviceBatchCreateAccount.cancelBatchCreateAccountsFlow();
              }
        }
      />
    </Stack>
  );
}

export function showBatchCreateAccountProcessingDialog({
  navigation,
  allNetworkInfo,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
  renderProgressContent,
  onDialogClose,
  ...dialogProps
}: IDialogShowProps & {
  navigation?: IAppNavigation;
  allNetworkInfo?: IBatchCreateAccountAllNetworkInfo;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
  renderProgressContent?: (props: {
    progressCurrent: number;
    progressTotal: number;
  }) => React.ReactNode;
  onDialogClose?: () => void;
}) {
  setGlobalShowDeviceProgressDialogEnabled(false);
  Dialog.show({
    showExitButton: false,
    dismissOnOverlayPress: false,
    onCancel() {
      setGlobalShowDeviceProgressDialogEnabled(true);
      void backgroundApiProxy.serviceBatchCreateAccount.cancelBatchCreateAccountsFlow();
    },
    onClose() {
      onDialogClose?.();
      setGlobalShowDeviceProgressDialogEnabled(true);
      void backgroundApiProxy.serviceBatchCreateAccount.cancelBatchCreateAccountsFlow();
    },
    // title: '',
    renderContent: (
      <ProcessingDialogContent
        allNetworkInfo={allNetworkInfo}
        navigation={navigation}
        closeAfterDone={closeAfterDone}
        closeAfterCancel={closeAfterCancel}
        closeAfterError={closeAfterError}
        renderProgressContent={renderProgressContent}
      />
    ),
    ...dialogProps,
  });
}
