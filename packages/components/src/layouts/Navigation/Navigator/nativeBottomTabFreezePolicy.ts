import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';

export function shouldFreezeNativeBottomTab({
  isNativeIOS,
  routeName,
}: {
  isNativeIOS: boolean;
  routeName: string;
}): boolean {
  if (isNativeIOS) {
    return false;
  }
  return routeName !== ETabRoutes.Home;
}
