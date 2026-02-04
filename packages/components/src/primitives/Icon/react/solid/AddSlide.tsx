import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddSlide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2zm14 2H8a2 2 0 0 0-2 2v8H4V4h12zm-1 5a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddSlide;
