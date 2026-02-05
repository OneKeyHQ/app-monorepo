import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPrime = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5 12H1l3-9h10a8 8 0 1 1 0 16v2H5zm9 5a6 6 0 0 0 0-12zm-7 2h5V5H5.442l-1.667 5H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPrime;
