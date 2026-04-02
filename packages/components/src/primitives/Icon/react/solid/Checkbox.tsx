import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckbox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zm-10.003-8.164-2-2-1.414 1.414 3.414 3.414 5.914-5.914-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckbox;
