import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShoppingBagAdd2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.4 15 1 2.6 2.6 1v.8l-2.6 1-1 2.6h-.8l-1-2.6-2.6-1v-.8l2.6-1 1-2.6z" />
    <Path
      fillRule="evenodd"
      d="M12 2a4 4 0 0 1 4 4v1h2.358l.923 6h-3.054l-1.175 3.052-3.051 1.175v3.546l3.051 1.174.02.053H3.335L5.642 7H8V6a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShoppingBagAdd2;
