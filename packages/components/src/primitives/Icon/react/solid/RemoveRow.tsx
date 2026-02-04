import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveRow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20.293 15.293a1 1 0 1 1 1.414 1.414L20.414 18l1.293 1.293a1 1 0 1 1-1.414 1.414L19 19.414l-1.293 1.293a1 1 0 1 1-1.414-1.414L17.586 18l-1.293-1.293a1 1 0 1 1 1.414-1.414L19 16.586z" />
    <Path d="M20 3a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H4v5h7a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
  </Svg>
);
export default SvgRemoveRow;
