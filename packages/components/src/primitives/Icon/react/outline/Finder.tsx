import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.465 5a45 45 0 0 0-1.142 7h.927a1 1 0 1 1 0 2h-2a1 1 0 0 1-.998-1.058A46.7 46.7 0 0 1 11.407 5H5v14h14V5zm1.98 9.668a1 1 0 1 1 1.11 1.664C14.98 17.382 13.534 18 12 18s-2.98-.619-4.555-1.668a1 1 0 1 1 1.11-1.664C9.98 15.618 11.034 16 12 16s2.02-.381 3.445-1.332M7 10V9a1 1 0 0 1 2 0v1a1 1 0 1 1-2 0m8 0V9a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0m6 9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgFinder;
