import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSlides = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 8h4v12H6v-4H2V4h16zM4 6v8h2V8h10V6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSlides;
