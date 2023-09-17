import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthereumClassic = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M11.445 7.39 8.08 2.065 4.62 7.39 8.08 5.954l3.365 1.435ZM4.755 8.855l3.365 5.212 3.462-5.212-3.462 2.072-3.365-2.072Z"
      clipRule="evenodd"
    />
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="m11.581 8.17-3.5-1.458-3.462 1.459 3.461 2.073 3.501-2.073Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEthereumClassic;
