import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8.28 3.67a.957.957 0 0 1 1.353 0l6.978 6.977a1.914 1.914 0 0 1 0 2.706l-6.978 6.978a.957.957 0 0 1-1.353-1.353L15.258 12 8.28 5.022a.957.957 0 0 1 0-1.353Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChevronRight;
