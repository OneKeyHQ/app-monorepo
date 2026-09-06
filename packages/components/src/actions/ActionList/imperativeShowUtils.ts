export type IActionListTriggerPosition = {
  x: number;
  y: number;
};

export type IActionListTriggerRect = IActionListTriggerPosition & {
  width: number;
  height: number;
};

export type IActionListPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end';

const ESTIMATED_MENU_HEIGHT = 200;
const ESTIMATED_MENU_WIDTH = 224; // $56 = 56 * 4 = 224px
const EDGE_PADDING = 8;
const CLOSE_ANIMATION_DURATION = 500;

export function preventImperativeActionListCloseAutoFocus(event: {
  preventDefault: () => void;
}) {
  event.preventDefault();
}

export function createImperativeActionListLifecycle({
  onOpenChange,
  onClose,
  destroy,
  schedule = (callback, delay) => {
    setTimeout(callback, delay);
  },
}: {
  onOpenChange?: (isOpen: boolean) => void;
  onClose?: () => void;
  destroy: () => void;
  schedule?: (callback: () => void, delay: number) => void;
}) {
  let isClosed = false;

  const handleOpenChange = (isOpen: boolean) => {
    if (isClosed) {
      return;
    }
    if (isOpen) {
      onOpenChange?.(true);
      return;
    }

    isClosed = true;
    onOpenChange?.(false);
    if (onClose) {
      schedule(onClose, 0);
    }
    schedule(destroy, CLOSE_ANIMATION_DURATION);
  };

  return {
    handleOpenChange,
    close: () => handleOpenChange(false),
  };
}

export function getImperativeActionListPlacement({
  triggerPosition,
  triggerRect,
  windowWidth,
  windowHeight,
  isRTL,
}: {
  triggerPosition?: IActionListTriggerPosition;
  triggerRect?: IActionListTriggerRect;
  windowWidth: number;
  windowHeight: number;
  isRTL: boolean;
}): IActionListPlacement {
  const left = triggerRect?.x ?? triggerPosition?.x ?? 0;
  const right = triggerRect ? triggerRect.x + triggerRect.width : left;
  const bottom = triggerRect
    ? triggerRect.y + triggerRect.height
    : (triggerPosition?.y ?? 0);

  const spaceBelow = windowHeight - bottom - EDGE_PADDING;
  const spaceForStartAlignment = isRTL
    ? right - EDGE_PADDING
    : windowWidth - left - EDGE_PADDING;

  const vertical = spaceBelow >= ESTIMATED_MENU_HEIGHT ? 'bottom' : 'top';
  const horizontal =
    spaceForStartAlignment >= ESTIMATED_MENU_WIDTH ? 'start' : 'end';

  return `${vertical}-${horizontal}` as IActionListPlacement;
}

export function getImperativeActionListProxyGeometry({
  triggerPosition,
  triggerRect,
}: {
  triggerPosition?: IActionListTriggerPosition;
  triggerRect?: IActionListTriggerRect;
}) {
  if (triggerRect) {
    return {
      left: triggerRect.x,
      top: triggerRect.y,
      containerWidth: triggerRect.width,
      containerHeight: triggerRect.height,
      triggerWidth: triggerRect.width,
      triggerHeight: triggerRect.height,
    };
  }

  if (triggerPosition) {
    return {
      left: triggerPosition.x,
      top: triggerPosition.y,
      containerWidth: 0,
      containerHeight: 0,
      triggerWidth: 1,
      triggerHeight: 1,
    };
  }

  return undefined;
}
