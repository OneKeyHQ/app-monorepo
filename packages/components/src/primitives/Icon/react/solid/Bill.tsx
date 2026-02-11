import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBill = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v17a1 1 0 0 1-1.65.76l-1.683-1.443-1.683 1.442a1 1 0 0 1-1.302 0L12 20.317l-1.682 1.442a1 1 0 0 1-1.302 0l-1.683-1.442-1.682 1.442A1 1 0 0 1 4 21zm4 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBill;
