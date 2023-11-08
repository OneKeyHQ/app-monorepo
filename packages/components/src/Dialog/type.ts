import type { IButtonProps } from '../Button';
import type { ICON_NAMES } from '../Icon';
import type {
  DialogProps as TMDialogProps,
  SheetProps as TMSheetProps,
} from 'tamagui';

export type IDialogContextType = {
  dialogInstance?: IDialogInstanceRef;
};

export interface IDialogProps extends TMDialogProps {
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

