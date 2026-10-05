import { useWindowDimensions } from 'react-native';

/**
 * Identifies the window shape a remembered header height belongs to.
 *
 * The bar is not the same height in every shape — rotation changes it, and so
 * does iPad split view — so a height measured in one shape must never be
 * handed to a mount in another. A page that remounts after rotation reports
 * its new height on the very first render and never changes it, which cannot
 * be told apart from a pre-measurement value by equality alone.
 *
 * Kept out of useSettledHeaderHeight so that hook stays free of react-native
 * and keeps running under its jsdom tests.
 */
export function useHeaderHeightCacheKey(): string {
  const { width, height } = useWindowDimensions();
  return `${Math.round(width)}x${Math.round(height)}`;
}
