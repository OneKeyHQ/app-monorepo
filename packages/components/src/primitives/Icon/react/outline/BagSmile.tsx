import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBagSmile = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 8a2 2 0 1 0 4 0V7h2v1a4 4 0 1 1-8 0V7h2z" />
    <Path
      fillRule="evenodd"
      d="M21.064 21H2.936L4.06 3h15.878l1.125 18Zm-16-2h13.872L18.06 5H5.939z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBagSmile;
