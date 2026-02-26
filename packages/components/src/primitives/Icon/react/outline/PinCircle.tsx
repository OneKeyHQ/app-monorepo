import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPinCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.525 7.024A3.5 3.5 0 1 1 13 12.854V17h-2v-4.145a3.5 3.5 0 0 1-1.475-5.831M13.06 8.44a1.5 1.5 0 1 0-2.122 2.123A1.5 1.5 0 0 0 13.06 8.44"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-2 0a8 8 0 1 0-16 0 8 8 0 0 0 16 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPinCircle;
