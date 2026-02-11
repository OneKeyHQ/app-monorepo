import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerUpRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.957 20a1 1 0 0 0 1-1v-9h12.586l-2.293 2.293a1 1 0 0 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414l-4-4a1 1 0 1 0-1.414 1.414L17.543 8H4.957a2 2 0 0 0-2 2v9a1 1 0 0 0 1 1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCornerUpRight;
