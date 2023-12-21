import type { MutableRefObject, PropsWithChildren } from 'react';

import type { IFormProps } from '../../forms';
import type { IButtonProps, IKeyOfIcons } from '../../primitives';
import type { UseFormProps, useForm } from 'react-hook-form';
import type {
  DialogContentProps as TMDialogContentProps,
  DialogProps as TMDialogProps,
  SheetProps as TMSheetProps,
} from 'tamagui';

export type IDialogContextType = {
  dialogInstance: IDialogInstanceRef;
  footerRef: {
    notifyUpdate?: () => void;
    props?: IDialogFooterProps;
  };
};

export interface IDialogContentProps extends PropsWithChildren {
  estimatedContentHeight?: number;
  testID?: string;
}

type IDialogButtonProps = Omit<IButtonProps, 'children'> & {
  disabledOn?: (params: Pick<IDialogInstance, 'getForm'>) => boolean;
};
export interface IDialogFooterProps extends PropsWithChildren {
  tone?: 'default' | 'destructive' | 'warning';
  showFooter?: boolean;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IDialogButtonProps;
  cancelButtonProps?: IDialogButtonProps;
  onConfirm?: IOnDialogConfirm;
  onCancel?: () => void;
  // disabledOn: () => void;
}

interface IBasicDialogProps extends TMDialogProps {
  onOpen?: () => void;
  onClose: () => Promise<void>;
  icon?: IKeyOfIcons;
  title?: string;
  description?: string;
  /* estimatedContentHeight is a single numeric value that hints Dialog about the approximate size of the content before they're rendered.  */
  estimatedContentHeight?: number;
  renderContent?: React.ReactNode;
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
  floatingPanelProps?: TMDialogContentProps;
  contextValue?: IDialogContextType;
  disableDrag?: boolean;
  testID?: string;
  onConfirm?: IOnDialogConfirm;
  onCancel?: () => void;
}

export type IDialogProps = IBasicDialogProps &
  Omit<IDialogFooterProps, 'onConfirm' | 'onCancel'>;

export type IOnDialogConfirm = (
  dialogInstance: IDialogInstance & {
    preventClose: () => void;
  },
) => void | Promise<void>;

export type IDialogContainerProps = PropsWithChildren<
  Omit<IDialogProps, 'onConfirm'> & {
    onConfirm?: IOnDialogConfirm;
  }
>;

export interface IDialogShowProps
  extends Omit<IDialogContainerProps, 'name' | 'onClose'> {
  onClose?: () => void;
  /* Run it after dialog is closed  */
  onDismiss?: () => void;
}

export type IDialogConfirmProps = Omit<
  IDialogShowProps,
  'onCancel' | 'onCancelText' | 'cancelButtonProps' | 'showFooter'
>;

export type IDialogCancelProps = Omit<
  IDialogShowProps,
  'onConfirm' | 'onConfirmText' | 'ConfirmButtonProps' | 'showFooter'
>;

type IDialogForm = ReturnType<typeof useForm>;

export interface IDialogInstanceRef {
  close: () => Promise<void>;
  ref: MutableRefObject<IDialogForm | undefined>;
}

export interface IDialogInstance {
  close: () => Promise<void> | void;
  getForm: () => IDialogForm | undefined;
}

export type IDialogFormProps = Omit<IFormProps, 'form'> & {
  formProps: UseFormProps;
};
