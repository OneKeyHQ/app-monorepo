import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImage2Mountains = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.25 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 5v8.586l3-3 4 4 2-2 5 5V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImage2Mountains;
