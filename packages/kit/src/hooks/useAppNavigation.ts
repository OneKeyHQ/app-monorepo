/* eslint-disable @typescript-eslint/no-non-null-assertion */
export default function useAppNavigation() {
  // useNavigation() not working for OverlayContainer/Portal Component
  return global.$navigationRef.current!;
}
