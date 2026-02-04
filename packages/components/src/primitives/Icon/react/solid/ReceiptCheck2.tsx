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
      d="M6 2a2 2 0 0 0-2 2v17a1 1 0 0 0 1.65.76l1.683-1.443 1.683 1.442a1 1 0 0 0 1.302 0L12 20.317l1.682 1.442a1 1 0 0 0 1.302 0l1.683-1.442 1.682 1.442A1 1 0 0 0 20 21V4a2 2 0 0 0-2-2zm2 13a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1m7.207-6.293a1 1 0 0 0-1.414-1.414L11.5 9.586l-.793-.793a1 1 0 1 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceiptCheck2;
