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
      d="M12 2q.563 0 1.11.06C18.111 2.615 22 6.853 22 12s-3.889 9.387-8.89 9.94Q12.563 22 12 22C6.477 22 2 17.523 2 12S6.477 2 12 2m0 2a8 8 0 1 0 0 16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContrast;
