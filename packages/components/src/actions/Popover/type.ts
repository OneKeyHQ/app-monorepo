/* cspell:ignore hoverable */
import type {
  ComponentType,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';

import type { IPopoverHoverable } from './anchoredPopover';
import type { ISheetOptions } from '../../hocs/NativeSheetPresentation/types';
import type { IYStackProps } from '../../primitives';
import type { IIconButtonProps } from '../IconButton';
import type { FlipOptions, OffsetOptions, Placement } from '@floating-ui/dom';

export interface IPopoverProps {
  title: string | ReactElement;
  description?: string;
  showHeader?: boolean;
  /** Narrow windows (and native) present a sheet; `false` keeps the panel. */
  usingSheet?: boolean;
  renderTrigger: ReactNode;
  renderContent:
    | ReactElement
    | ComponentType<{ isOpen?: boolean; closePopover: () => void }>
    | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  openPopover?: () => void;
  closePopover?: () => void;
  /** Anchored panel (web, wide windows): side and alignment. */
  placement?: Placement;
  /** Anchored panel: gap to the trigger (px, or per-axis). */
  offset?: OffsetOptions;
  /** Anchored panel: flip to the other side when it does not fit. */
  allowFlip?: boolean | FlipOptions;
  /** Anchored panel: open on hover instead of press. */
  hoverable?: IPopoverHoverable;
  /** Keep the content mounted (hidden) while closed. */
  keepChildrenMounted?: boolean | 'lazy';
  /** Styles the anchored panel. */
  floatingPanelProps?: IYStackProps & {
    onOpenAutoFocus?: (event: Event) => void;
    onCloseAutoFocus?: (event: Event) => void;
    trapFocus?: boolean;
  };
  sheetProps?: ISheetOptions;
  mountNativePortalBeforeOpen?: boolean;
  /**
   * Unique identifier for tracking/analytics purposes.
   */
  trackID?: string;
}

export interface IPopoverContent extends PropsWithChildren {
  isOpen?: boolean;
  closePopover: () => void;
}

export interface IPopoverTooltip {
  tooltip?: string;
  title: string;
  placement?: IPopoverProps['placement'];
  renderContent?: IPopoverProps['renderContent'];
  triggerProps?: Partial<IIconButtonProps>;
}
