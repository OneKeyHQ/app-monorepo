import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 12c0-3.11 1.17-6.03 3.08-7.901C6.354 4.68 4 7.8 4 12s2.354 7.318 5.08 7.9C7.17 18.028 6 15.11 6 12m2 0c0 4.667 2.906 8 6 8s6-3.333 6-8-2.906-8-6-8-6 3.333-6 8m14 0c0 5.274-3.362 10-8 10h-4c-4.638 0-8-4.726-8-10S5.362 2 10 2h4c4.638 0 8 4.726 8 10" />
  </Svg>
);
export default SvgCoin;
