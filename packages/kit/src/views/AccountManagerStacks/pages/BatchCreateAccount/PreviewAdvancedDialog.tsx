import { useRef } from 'react';

import { Dialog, Stack } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT,
  BatchCreateAccountFormBase,
  type IBatchCreateAccountFormValues,
} from './BatchCreateAccountFormBase';

import type { UseFormReturn } from 'react-hook-form';

type IAdvancedDialogProps = {
  networkId: string;
  defaultFrom: string;
  defaultCount: string;
  defaultDeriveType: IAccountDeriveTypes | undefined;
  onSubmit?: (
    values: IBatchCreateAccountFormValues | undefined,
  ) => Promise<void>;
};

function DialogContentView({
  defaultDeriveType,
  defaultFrom,
  defaultCount,
  networkId,
  onSubmit,
}: IAdvancedDialogProps) {
  const formRef = useRef<
    UseFormReturn<IBatchCreateAccountFormValues, any, undefined> | undefined
  >(undefined);

  return (
    <Stack>
      <BatchCreateAccountFormBase
        networkReadyOnly
        alwaysShowAdvancedSettings
        // activeAccount?.network?.id ?? getNetworkIdsMap().onekeyall
        defaultNetworkId={networkId}
        defaultDeriveType={defaultDeriveType}
        defaultFrom={defaultFrom}
        defaultCount={
          defaultCount || String(BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT)
        }
        formRef={formRef}
      />
      <Dialog.Footer
        showCancelButton={false}
        onConfirm={async ({ preventClose, close }) => {
          preventClose();
          if (
            Object.keys(formRef?.current?.formState?.errors || {}).length > 0
          ) {
            return;
          }
          await formRef?.current?.handleSubmit(async (values) => {
            await onSubmit?.(values);
            await close();
          })();
        }}
      />
    </Stack>
  );
}

export function showBatchCreateAccountPreviewAdvancedDialog({
  networkId,
  defaultDeriveType,
  defaultFrom,
  defaultCount,
  onSubmit,
  ...dialogProps
}: IDialogShowProps & IAdvancedDialogProps) {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_advanced,
    }),
    renderContent: (
      <DialogContentView
        defaultDeriveType={defaultDeriveType}
        defaultFrom={defaultFrom}
        defaultCount={defaultCount}
        networkId={networkId}
        onSubmit={onSubmit}
      />
    ),
    ...dialogProps,
  });
}
