import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBasket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.177 8h4.021l-2.215 12.179-.148.821H4.165l-.148-.821L1.802 8h4.021l2.12-5.3 1.857.743L7.978 8h8.044L14.2 3.443l1.857-.743zM5.834 19h12.332l1.637-9H4.197z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBasket;
