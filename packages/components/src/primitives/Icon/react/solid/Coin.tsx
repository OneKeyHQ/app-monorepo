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
      d="M14 2c4.638 0 8 4.726 8 10s-3.362 10-8 10h-4c-4.638 0-8-4.726-8-10S5.362 2 10 2zM9.08 4.098C6.354 4.68 4 7.8 4 12s2.354 7.32 5.08 7.902C7.17 18.03 6 15.11 6 12s1.17-6.03 3.08-7.902"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoin;
