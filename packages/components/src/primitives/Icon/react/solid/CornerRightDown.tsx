import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerRightDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.962 4.005c0 .555.45 1.005 1.005 1.005h9.043v12.645l-2.304-2.304a1.005 1.005 0 0 0-1.421 1.421l4.019 4.02a1.005 1.005 0 0 0 1.42 0l4.02-4.02a1.005 1.005 0 1 0-1.421-1.42l-2.304 2.303V5.01c0-1.11-.9-2.01-2.01-2.01H4.967c-.555 0-1.005.45-1.005 1.005"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCornerRightDown;
