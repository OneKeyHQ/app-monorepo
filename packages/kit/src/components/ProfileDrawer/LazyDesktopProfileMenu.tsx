import { Image, Stack, preloadLazyTooltip } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { ErrorBoundarySimple } from '../ErrorBoundary';

// The default avatar holds its place in the rail until the menu loads.
function DesktopProfileMenuFallback() {
  return (
    <Stack w={40} h={40} p="$2">
      <Image size="$6" borderRadius="$full" source={avatarFallback} />
    </Stack>
  );
}

const DesktopProfileMenuLoader = LazyLoad(
  async () => {
    const [{ DesktopProfileMenu }] = await Promise.all([
      import('./DesktopProfileMenu'),
      // Swapped in under a resting pointer, the tooltip would not open on the
      // first hover, so it is ready before the avatar mounts.
      preloadLazyTooltip().catch(() => undefined),
    ]);
    return { default: DesktopProfileMenu };
  },
  undefined,
  <DesktopProfileMenuFallback />,
);

const DesktopDeviceUpdateDotLoader = LazyLoad(async () => {
  const { DesktopDeviceUpdateDot } = await import('./DesktopProfileMenu');
  return { default: DesktopDeviceUpdateDot };
});

// A menu or dot that fails to load leaves the rail as it was, not the app's
// error screen.
export function LazyDesktopProfileMenu() {
  return (
    <ErrorBoundarySimple fallback={<DesktopProfileMenuFallback />}>
      <DesktopProfileMenuLoader />
    </ErrorBoundarySimple>
  );
}

export function LazyDesktopDeviceUpdateDot() {
  return (
    <ErrorBoundarySimple fallback={null}>
      <DesktopDeviceUpdateDotLoader />
    </ErrorBoundarySimple>
  );
}
