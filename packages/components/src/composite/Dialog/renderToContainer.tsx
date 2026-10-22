import { EPortalContainerConstantName } from '../../hocs/Portal';
import { mountImperativeOverlay } from '../../shared/imperativeOverlayMount';

import type { IRenderToContainer } from './type';
import type {
  IImperativeOverlayPageKey,
  IImperativeOverlayTarget,
} from '../../shared/imperativeOverlayMount';

function targetForDialog(
  container: EPortalContainerConstantName,
  page?: IImperativeOverlayPageKey,
): IImperativeOverlayTarget {
  if (
    container === EPortalContainerConstantName.APP_STATE_LOCK_CONTAINER_OVERLAY
  ) {
    return 'lock';
  }
  return page ? 'page' : 'global';
}

// The dialog's OverlayView owns presentation; this only keeps its React node
// mounted outside a frozen page tree.
export const renderToContainer: IRenderToContainer = (
  container,
  element,
  page,
  onPageUnavailable,
) =>
  mountImperativeOverlay({
    target: targetForDialog(container, page),
    page,
    node: element,
    onPageUnavailable,
    onHostUnavailable:
      container ===
      EPortalContainerConstantName.APP_STATE_LOCK_CONTAINER_OVERLAY
        ? onPageUnavailable
        : undefined,
  });
