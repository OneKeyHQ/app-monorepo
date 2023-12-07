import type { PropsWithChildren } from 'react';

import type { IButtonProps, IKeyOfIcons } from '../../primitives';
import type {
  DialogProps as TMDialogProps,
  SheetProps as TMSheetProps,
} from 'tamagui';

export type IDialogContextType = {
  dialogInstance?: IDialogInstanceRef;
};

export interface IDialogContentProps extends PropsWithChildren {
  estimatedContentHeight?: number;
  logContentHeight?: boolean;
}

export interface IDialogProps extends TMDialogProps {
  onOpen?: () => void;
  onClose?: () => void;
  renderTrigger?: React.ReactNode;
  icon?: IKeyOfIcons;
  title?: string;
  description?: string;
  tone?: 'default' | 'destructive';
  /* estimatedContentHeight is a single numeric value that hints Dialog about the approximate size of the content before they're rendered.  */
  estimatedContentHeight?: number;
  /* log the the size value of the content in Console. */
  logContentHeight?: boolean;
  renderContent?: React.ReactNode;
  showFooter?: boolean;
  onConfirm?: () => void | Promise<boolean>;
  onCancel?: () => void;
  onConfirmText?: string;
  onCancelText?: string;
  confirmButtonProps?: IButtonProps;
  cancelButtonProps?: IButtonProps;
  dismissOnOverlayPress?: TMSheetProps['dismissOnOverlayPress'];
  sheetProps?: Omit<TMSheetProps, 'dismissOnOverlayPress'>;
  contextValue?: IDialogContextType;
  disableDrag?: boolean;
}

export interface IDialogInstanceRef {
  close: () => void;
}
