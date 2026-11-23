import { Image, Stack, preloadLazyTooltip } from '@onekeyhq/components';
import avatarFallback from '@onekeyhq/kit/assets/avatar-fallback.png';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

// The default avatar holds its place in the rail until the menu loads.
function DesktopProfileMenuFallback() {
  return (
    <Stack w={40} h={40} p="$2">
      <Image size="$6" borderRadius="$full" source={avatarFallback} />
    </Stack>
  );
}

export const LazyDesktopProfileMenu = LazyLoad(
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

export const LazyDesktopDeviceUpdateDot = LazyLoad(async () => {
  const { DesktopDeviceUpdateDot } = await import('./DesktopProfileMenu');
  return { default: DesktopDeviceUpdateDot };
});
