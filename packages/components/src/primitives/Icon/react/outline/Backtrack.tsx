import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBacktrack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.666 10-2.002 2.002 2 2-1.414 1.414-2-2-2 2-1.414-1.414 2-2L9.834 10l1.414-1.414 2.002 2.002 2.002-2.002z" />
    <Path
      fillRule="evenodd"
      d="M22 20H7.485l-5.714-8 5.714-8H22zM4.229 12l4.286 6H20V6H8.515z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBacktrack;
