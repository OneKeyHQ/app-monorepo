import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCart = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 19a2 2 0 1 1 4 0 2 2 0 0 1-4 0m9 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0" />
    <Path
      fillRule="evenodd"
      d="m4.847 2 .5 3H22.18l-1.834 11H5.153l-2-12H1V2zm2 12h11.806l1.166-7H5.681z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCart;
