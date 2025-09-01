import type {
  Dispatch,
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  SetStateAction,
} from 'react';

import type { EPortalContainerConstantName, IPortalManager } from '../../hocs';
import type {
  IButtonProps,
  IKeyOfIcons,
  IStackProps,
  IXStackProps,
  IYStackProps,
} from '../../primitives';
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
  trackID?: string;
  isAsync?: boolean;
}

export type IDialogButtonProps = Omit<IButtonProps, 'children'> & {
  disabledOn?: (params: Pick<IDialogInstance, 'getForm'>) => boolean;
};
export interface IDialogFooterProps extends PropsWithChildren {
  tone?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
  trackID?: string;
  showFooter?: boolean;
  footerProps?: Omit<IXStackProps, 'children'>;
  contentContainerProps?: Omit<IStackProps, 'children'>;
  showExitButton?: boolean;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IDialogButtonProps;
  cancelButtonProps?: IDialogButtonProps;
  onConfirm?: IOnDialogConfirm;
  onCancel?: () => void;
}

export type IDialogHeaderProps = PropsWithChildren<{
  icon?: IKeyOfIcons;
  title?: string;
  description?: string | ReactElement;
  showExitButton?: boolean;
  tone?: 'default' | 'destructive' | 'warning' | 'success' | 'info';
  renderIcon?: ReactElement;
}>;

export interface IDialogHeaderContextType {
  headerProps: IDialogHeaderProps;
  setHeaderProps: Dispatch<SetStateAction<IDialogHeaderProps>>;
}

interface IBasicDialogProps extends TMDialogProps {
  /* If true, the content will be rendered later and fit content height. */
  isAsync?: boolean;
  onOpen?: () => void;
  onHeaderCloseButtonPress?: () => void;
  onClose: (extra?: { flag?: string }) => Promise<void>;
  isExist?: () => boolean;
  icon?: IKeyOfIcons;
  renderIcon?: ReactElement;
  title?: string;
  description?: string | ReactElement;
  trackID?: string;
  /* estimatedContentHeight is a single numeric value that hints Dialog about the approximate size of the content before they're rendered.  */
  estimatedContentHeight?: number;
  renderContent?: ReactNode;
  // close on overlay or backdrop press
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
  sheetOverlayProps?: IYStackProps;
  floatingPanelProps?: TMDialogContentProps;
  contextValue?: IDialogContextType;
  disableDrag?: boolean; // disable drag gesture to close
  testID?: string;
  onConfirm?: IOnDialogConfirm;
  onCancel?: (close: () => Promise<void>) => void;
  /**
   * When dialog's modal is not true and it's not a sheet, overlay won't show by default.
   * forceMount controls whether to force show the overlay in this case.
   */
  forceMount?: boolean;
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
  /**
   * If true, the dialog will be rendered on top of all views.
   * On web, it will be rendered to document.body, on iOS, it will be rendered to Window Overlay top layer.
   * Default is false.
   * @platform iOS, Web
   */
  isOverTopAllViews?: boolean;
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
  isExist: () => boolean;
}

export interface IDialogInstance {
  close: (extra?: { flag?: string }) => Promise<void> | void;
  getForm: () => IDialogForm | undefined;
  isExist: () => boolean;
}

export type IDialogFormProps = PropsWithChildren<{
  formProps: UseFormProps;
}>;

export type IRenderToContainer = (
  container: EPortalContainerConstantName,
  element: ReactElement,
  isOverTopAllViews?: boolean,
) => IPortalManager;
