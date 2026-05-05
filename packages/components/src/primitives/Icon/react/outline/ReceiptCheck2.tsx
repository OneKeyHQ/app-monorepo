import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgReceiptCheck2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 15H9v-2h6zm.164-7.45L11.3 11.416 8.836 8.95l1.414-1.414 1.05 1.05 2.45-2.45 1.414 1.415Z" />
    <Path
      fillRule="evenodd"
      d="M20 21.974 15.5 19.4l-3.5 2-3.5-2L4 21.974V2h16zM6 18.526 8.5 17.1l3.5 1.999 3.5-2 2.5 1.428V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptCheck2;
