import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.677 2.512a1.465 1.465 0 0 1 1.811 1.811L17.972 16.63a1.95 1.95 0 0 1-1.342 1.342L4.323 21.488a1.465 1.465 0 0 1-1.811-1.81L6.028 7.37A1.95 1.95 0 0 1 7.37 6.028zM9.558 12a2.442 2.442 0 1 1 4.884 0 2.442 2.442 0 0 1-4.884 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompass;
