import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlashcards = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.412 20.955 4.467 22 3 8.045 12.945 7z" />
    <Path d="M21.112 3.045 19.646 17l-3.985-.42-1.203-11.45-3.661.385.37-3.516 9.945 1.045Z" />
  </Svg>
);
export default SvgFlashcards;
