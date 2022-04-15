import React, { FC, useCallback, useMemo } from 'react';

import { Dialog as DialogView } from '@onekeyhq/components';
import { DialogProps } from '@onekeyhq/components/src/Dialog/index';
import { isDev } from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks/redux';
import { hideDialog, showDialog } from '../../store/reducers/dialog';

import type {
  GlobalDialogIds,
  GlobalDialogParamsType,
} from '../../routes/Dialog';

const dialogCallbacks: Record<string, (value: any) => void> = {};

if (isDev()) {
  // @ts-expect-error
  global.$dialogCallbacks = dialogCallbacks;
}

function useDialog<T extends GlobalDialogParamsType<any, any>>(
  dialogId: GlobalDialogIds,
) {
  const { dispatch } = backgroundApiProxy;

  type ParamsType = T['params'];
  type ResultType = T['result'] | boolean;

  const show = useCallback(
    (args: ParamsType) =>
      new Promise<ResultType>((resolve) => {
        dialogCallbacks[dialogId] = resolve;
        dispatch(showDialog({ dialogId, args }));
      }),
    [dispatch, dialogId],
  );

  const resolve = useCallback(
    (args: ResultType) => {
      if (dialogCallbacks[dialogId]) {
        dialogCallbacks[dialogId](args);
      }
    },
    [dialogId],
  );

  const hide = useCallback(() => {
    dispatch(hideDialog({ dialogId }));
    delete dialogCallbacks[dialogId];
  }, [dispatch, dialogId]);

  const args: ParamsType = useAppSelector(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    (s) => s.dialog.data[dialogId],
  );

  return useMemo(
    () => ({ args, visible: !!args, show, hide, resolve }),
    [args, hide, show, resolve],
  );
}

export type CommonDialogProps = {
  dialogId: GlobalDialogIds;
} & DialogProps;

const CommonDialog: FC<CommonDialogProps> = ({ dialogId, ...props }) => {
  const { visible, hide, resolve } = useDialog(dialogId);
  const { onClose, footerButtonProps } = props;

  if (!visible) return null;

  return (
    <DialogView
      {...props}
      hasFormInsideDialog
      visible={visible}
      onClose={() => {
        onClose?.();
        hide();
      }}
      footerButtonProps={{
        ...footerButtonProps,
        onPrimaryActionPress: () => {
          resolve(true);
          hide();
        },
      }}
    />
  );
};

export default CommonDialog;
export { useDialog };
