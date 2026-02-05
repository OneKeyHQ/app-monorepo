import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronBottom = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.67 8.28a.957.957 0 0 1 1.352 0L12 15.258l6.978-6.978a.957.957 0 1 1 1.353 1.353l-6.978 6.978a1.914 1.914 0 0 1-2.706 0L3.669 9.633a.957.957 0 0 1 0-1.353Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronBottom;
