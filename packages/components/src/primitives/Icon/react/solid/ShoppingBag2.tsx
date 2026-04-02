import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShoppingBag2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.002 2a4 4 0 0 1 4 4v1h2.357l2.308 15H3.336L5.644 7h2.358V6a4 4 0 0 1 4-4m0 2a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShoppingBag2;
