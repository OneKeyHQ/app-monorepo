import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { registerOpenTooltip } from './tooltipRegistry';

const HOVER_OPEN_DELAY_MS = 250;
const HOVER_CLOSE_DELAY_MS = 300;
const FORCE_CLOSE_SETTLE_MS = 150;
const FORCE_CLOSE_RELEASE_MS = 200;
const OPEN_SETTLE_MS = 50;

export interface ITooltipPointerDownEvent {
  pointerType?: string;
}

// Hover state for interactive (`hovering`) tooltips: the content stays open
// while the pointer is over either the trigger or the content.
const useHoverTooltip = () => {
  const [isHovered, setIsHovered] = useState(false);
  const showTooltipRef = useRef(isHovered);
  showTooltipRef.current = isHovered;
  const closeTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverIn = useCallback(() => {
    if (showTooltipRef.current) {
      if (closeTooltipTimer.current) {
        clearTimeout(closeTooltipTimer.current);
      }
    } else {
      showTooltipTimer.current = setTimeout(() => {
        setIsHovered(true);
      }, HOVER_OPEN_DELAY_MS);
    }
  }, []);
  const dismissTooltip = useCallback(() => {
    setIsHovered(false);
  }, []);
  const handleHoverOut = useCallback(() => {
    if (showTooltipRef.current) {
      closeTooltipTimer.current = setTimeout(() => {
        dismissTooltip();
      }, HOVER_CLOSE_DELAY_MS);
    } else if (showTooltipTimer.current) {
      clearTimeout(showTooltipTimer.current);
    }
  }, [dismissTooltip]);
  return {
    setIsHovered,
    isHovered,
    onContentHoverIn: handleHoverIn,
    onContentHoverOut: handleHoverOut,
  };
};

export function useTooltipOpenState({ hovering }: { hovering?: boolean }) {
  const [isShow, setIsShow] = useState(false);
  const [forceClose, setForceClose] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  // A mouse/pen press on the trigger closes the tooltip and keeps it closed
  // until the pointer leaves the trigger, so activating the trigger (opening a
  // modal, copying, ...) never leaves a tooltip hanging over the result.
  const [isPressLatched, setIsPressLatched] = useState(false);
  const isPressLatchedRef = useRef(isPressLatched);
  isPressLatchedRef.current = isPressLatched;

  const { isHovered, setIsHovered, onContentHoverIn, onContentHoverOut } =
    useHoverTooltip();

  const isOpen = useMemo(() => {
    if (forceClose || isPressLatched) {
      return false;
    }
    if (hovering) {
      return isHovered;
    }
    return isDisabled ? false : isShow;
  }, [forceClose, isPressLatched, hovering, isDisabled, isShow, isHovered]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsShow(open);
  }, []);

  const handleTriggerPointerDown = useCallback(
    (event: ITooltipPointerDownEvent) => {
      // Touch has no hover: a tap is the only way to reveal the tooltip there.
      if (event.pointerType === 'touch') {
        return;
      }
      setIsPressLatched(true);
      setIsShow(false);
      setIsHovered(false);
    },
    [setIsHovered],
  );

  const handleTriggerMouseEnter = useCallback(() => {
    if (hovering) {
      onContentHoverIn();
    }
  }, [hovering, onContentHoverIn]);

  const handleTriggerMouseLeave = useCallback(() => {
    if (isPressLatchedRef.current) {
      setIsPressLatched(false);
      // Drop open requests that arrived while latched; the tooltip must only
      // reopen on a fresh hover.
      setIsShow(false);
      setIsHovered(false);
    }
    if (hovering) {
      onContentHoverOut();
    }
  }, [hovering, onContentHoverOut, setIsHovered]);

  const handleContentMouseEnter = useCallback(() => {
    if (hovering) {
      onContentHoverIn();
    }
  }, [hovering, onContentHoverIn]);

  const handleContentMouseLeave = useCallback(() => {
    if (hovering) {
      onContentHoverOut();
    }
  }, [hovering, onContentHoverOut]);

  const closeTooltip = useCallback(() => {
    return new Promise<void>((resolve) => {
      setForceClose(true);
      setIsShow(false);
      setIsHovered(false);
      setTimeout(() => {
        resolve();
      }, FORCE_CLOSE_SETTLE_MS);
      setTimeout(() => {
        setForceClose(false);
      }, FORCE_CLOSE_RELEASE_MS);
    });
  }, [setIsHovered]);

  const openTooltip = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsShow(true);
      setIsHovered(true);
      setTimeout(() => {
        resolve();
      }, OPEN_SETTLE_MS);
    });
  }, [setIsHovered]);

  const closeFromRegistry = useCallback(() => {
    setIsShow(false);
    setIsHovered(false);
  }, [setIsHovered]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    return registerOpenTooltip(closeFromRegistry);
  }, [isOpen, closeFromRegistry]);

  return {
    isOpen,
    setIsShow,
    setIsDisabled,
    handleOpenChange,
    handleTriggerPointerDown,
    handleTriggerMouseEnter,
    handleTriggerMouseLeave,
    handleContentMouseEnter,
    handleContentMouseLeave,
    closeTooltip,
    openTooltip,
  };
}
