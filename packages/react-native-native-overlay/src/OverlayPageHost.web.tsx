import { useEffect, useRef } from 'react';

import { useSuspendedPageOwners } from './useSuspendedPageOwners';
import { registerOverlayPageHost } from './web/overlayLayers';

const OWNER_ATTRIBUTE = 'data-overlay-owner';

/**
 * Web page host: an absolutely positioned layer inside the root-route card.
 * Page overlays portal into it; entries of covered owners are hidden here
 * because their own (possibly inactive) page does not re-render.
 */
export function OverlayPageHost({ hostKey }: { hostKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const suspendedOwners = useSuspendedPageOwners(hostKey);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    return registerOverlayPageHost(hostKey, element);
  }, [hostKey]);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const suspended = new Set(suspendedOwners);
    element
      .querySelectorAll<HTMLElement>(`[${OWNER_ATTRIBUTE}]`)
      .forEach((node) => {
        const hidden = suspended.has(node.getAttribute(OWNER_ATTRIBUTE) ?? '');
        node.style.visibility = hidden ? 'hidden' : '';
        node.inert = hidden;
      });
  }, [suspendedOwners]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}

export { OWNER_ATTRIBUTE as OVERLAY_OWNER_ATTRIBUTE };
