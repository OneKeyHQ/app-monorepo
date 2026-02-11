import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.957 4a1 1 0 0 0-1 1v9H6.371l2.293-2.293a1 1 0 1 0-1.414-1.414l-4 4a1 1 0 0 0 0 1.414l4 4a1 1 0 0 0 1.414-1.414L6.371 16h12.586a2 2 0 0 0 2-2V5a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCornerDownLeft;
