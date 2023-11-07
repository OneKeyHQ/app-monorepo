import type { Dispatch, SetStateAction } from 'react';

import type { IButtonProps } from '../Button';
import type { FormProps } from '../Form';
import type { ICON_NAMES } from '../Icon';
import type { UseFormProps, UseFormReturn } from 'react-hook-form';
import type {
  DialogProps as TMDialogProps,
  SheetProps as TMSheetProps,
} from 'tamagui';

export type DialogContextType = {
  dialogInstance?: DialogInstanceRef;
  form?: DialogContextForm;
  setForm?: Dispatch<SetStateAction<DialogContextForm>>;
};

export interface DialogProps extends TMDialogProps {
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  icon?: ICON_NAMES;
  title?: string;
  description?: string;
  tone?: 'default' | 'destructive';
  renderContent?: React.ReactNode;
  showFooter?: boolean;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  confirmButtonProps?: IButtonProps;
  cancelButtonProps?: IButtonProps;
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
  contextValue?: DialogContextType;
}

export interface DialogInstanceRef {
  close: () => void;
}

export type DialogContextForm = UseFormReturn<any> | undefined;

export type DialogFormProps = Omit<FormProps, 'form'> & {
  useFormProps?: UseFormProps<any>;
};
