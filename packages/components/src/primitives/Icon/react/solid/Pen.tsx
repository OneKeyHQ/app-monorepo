import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.413 10.628 19.5 14.542l-1.096-1.096-3.42 7.217-11.63 1.54 6.127-6.128a2 2 0 1 0-1.414-1.414l-6.02 6.02L3.49 9.167l7.28-3.355-1.17-1.17L13.514.727l9.9 9.9ZM12.428 4.642l7.071 7.071 1.086-1.085-7.071-7.072z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPen;
