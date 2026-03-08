import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H2V4zM12 14.118l-8-4V18h16v-7.883zM4 7.882l8 4 8-4V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEmail2;
