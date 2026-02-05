import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronTopSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m12 11.48 3.233 3.232a.982.982 0 1 0 1.388-1.388l-3.406-3.407a1.72 1.72 0 0 0-2.43 0L7.38 13.324a.982.982 0 0 0 1.388 1.388z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronTopSmall;
