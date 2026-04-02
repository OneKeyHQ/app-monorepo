import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoins = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 3a7 7 0 0 1 6.328 4.008 7 7 0 1 1-6.657 9.983A7 7 0 0 1 9 3m5.718 6.008a5 5 0 1 0 .566 9.985 5 5 0 0 0-.566-9.985M9 5a5 5 0 0 0-.941 9.91 7 7 0 0 1 5.11-7.667A4.99 4.99 0 0 0 8.999 5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCoins;
