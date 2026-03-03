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
      d="M18 8h4v12H6v-4H2V4h16zM8 18h12v-8H8zm-4-4h2V8h10V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSlides;
