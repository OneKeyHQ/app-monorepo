import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFlashcards = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.9 7.21a2 2 0 0 1 2.198 1.78l1.049 9.976a2 2 0 0 1-1.78 2.198l-5.967.628a2 2 0 0 1-2.198-1.78l-1.05-9.978a2 2 0 0 1 1.781-2.198z" />
    <Path d="m13.1 2.208 5.967.628a2 2 0 0 1 1.78 2.198l-1.049 9.977a2 2 0 0 1-2.198 1.78l-1.995-.21-.817-7.77a3.7 3.7 0 0 0-4.046-3.295l.16-1.528a2 2 0 0 1 2.198-1.78" />
  </Svg>
);
export default SvgFlashcards;
