export function getDesktopNavigationState(isInPlace?: boolean) {
  const isInPlaceNavigation = isInPlace === true;
  return {
    isInPlace: isInPlaceNavigation,
    loading: !isInPlaceNavigation,
  } as const;
}
