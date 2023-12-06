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
  estimatedContentHeight?: number;
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
}

export interface IDialogInstanceRef {
  close: () => void;
}
