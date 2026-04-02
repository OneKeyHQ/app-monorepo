import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgContrast = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10q-.563 0-1.11-.06C5.889 21.386 2 17.148 2 12s3.889-9.386 8.89-9.94Q11.437 2 12 2m0 18a8 8 0 1 0 0-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContrast;
