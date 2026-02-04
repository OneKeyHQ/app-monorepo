import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.72 3.67a.957.957 0 0 1 0 1.352L8.742 12l6.978 6.978a.957.957 0 0 1-1.353 1.353l-6.978-6.978a1.914 1.914 0 0 1 0-2.706l6.978-6.978a.957.957 0 0 1 1.353 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronLeft;
