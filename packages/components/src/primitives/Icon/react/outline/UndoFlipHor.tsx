import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUndoFlipHor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m15.586 5 3 3H2v11h11v-2H4v-7h14.586l-3 3L17 14.414 22.414 9 17 3.586z" />
  </Svg>
);
export default SvgUndoFlipHor;
