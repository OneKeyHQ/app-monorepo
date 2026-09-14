export async function recoverPerpsSubscriptionsAfterNavigation(params: {
  isAppVisible: () => boolean;
  isAppLocked: () => Promise<boolean>;
  readDisabledCount: () => Promise<number>;
  recover: (disabledCount: number) => Promise<boolean>;
}): Promise<boolean> {
  try {
    if (!params.isAppVisible() || (await params.isAppLocked())) {
      return false;
    }

    const disabledCount = await params.readDisabledCount();
    if (!params.isAppVisible() || (await params.isAppLocked())) {
      return false;
    }

    return params.recover(disabledCount);
  } catch {
    return false;
  }
}
