import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgReceiptCheck2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 2v19.974L15.5 19.4l-3.5 2-3.5-2L4 21.974V2zM9 13v2h6v-2zm2.3-4.414-1.05-1.05L8.836 8.95l2.464 2.464 3.864-3.864-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptCheck2;
