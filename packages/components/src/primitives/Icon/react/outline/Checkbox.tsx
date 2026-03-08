import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.911 9.75-5.914 5.914-3.414-3.414 1.414-1.414 2 2 4.5-4.5z" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckbox;
