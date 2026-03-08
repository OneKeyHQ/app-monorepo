import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.44 19.712-4.805 1.379L13.5 6.67l4.807-1.377 4.133 14.418ZM5.5 5v16H2V5z" />
    <Path
      fillRule="evenodd"
      d="M13.5 21h-7V3h7zM8 17h4v-2H8zm0-8h4V7H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;
