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
      d="M16 4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 18h12v-8H8zm-4-4h2v-4a2 2 0 0 1 2-2h8V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSlides;
