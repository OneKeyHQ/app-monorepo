import type {
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';

import type { EPortalContainerConstantName, IPortalManager } from '../../hocs';
import type { IButtonProps, IKeyOfIcons, IStackProps } from '../../primitives';
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
  tone?: 'default' | 'destructive' | 'warning' | 'success';
  showFooter?: boolean;
  footerProps?: Omit<IStackProps, 'children'>;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IDialogButtonProps;
  cancelButtonProps?: IDialogButtonProps;
  onConfirm?: IOnDialogConfirm;
  onCancel?: () => void;
}

interface IBasicDialogProps extends TMDialogProps {
  onOpen?: () => void;
  onClose: (extra?: { flag?: string }) => Promise<void>;
  icon?: IKeyOfIcons;
  title?: string;
  description?: string;
  /* estimatedContentHeight is a single numeric value that hints Dialog about the approximate size of the content before they're rendered.  */
  estimatedContentHeight?: number;
  renderContent?: ReactNode;
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
  floatingPanelProps?: TMDialogContentProps;
  contextValue?: IDialogContextType;
  disableDrag?: boolean;
  testID?: string;
  onConfirm?: IOnDialogConfirm;
  onCancel?: (close: () => Promise<void>) => void;
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
  portalContainer?: EPortalContainerConstantName;
  /* Run it after dialog is closed  */
  onClose?: (extra?: { flag?: string }) => void | Promise<void>;
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
  close: (extra?: { flag?: string }) => Promise<void>;
  ref: MutableRefObject<IDialogForm | undefined>;
}

export interface IDialogInstance {
  close: (extra?: { flag?: string }) => Promise<void> | void;
  getForm: () => IDialogForm | undefined;
}

export type IDialogFormProps = PropsWithChildren<{
  formProps: UseFormProps;
}>;

export type IRenderToContainer = (
  container: EPortalContainerConstantName,
  element: ReactElement,
) => IPortalManager;
