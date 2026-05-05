import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 2c4.638 0 8 4.726 8 10s-3.362 10-8 10h-4c-4.638 0-8-4.726-8-10S5.362 2 10 2zm0 2c-3.094 0-6 3.333-6 8s2.906 8 6 8 6-3.333 6-8-2.906-8-6-8m-4.92.099C6.354 4.68 4 7.8 4 12s2.354 7.318 5.08 7.9C7.17 18.028 6 15.11 6 12s1.17-6.03 3.08-7.901"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoin;
