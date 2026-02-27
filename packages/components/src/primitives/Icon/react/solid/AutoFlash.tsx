import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.998 7.547h7.722L9.998 23.56v-7.638H2.223L13.998.55z" />
    <Path
      fillRule="evenodd"
      d="M23.5 23h-2.1l-.28-1.5h-3.36L16.8 23h-2.4l5.8-9h1.35zm-4.454-3.5h1.645l-.41-1.92z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAutoFlash;
