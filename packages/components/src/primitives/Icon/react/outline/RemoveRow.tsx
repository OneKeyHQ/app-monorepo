import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRemoveRow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.414 17-2 2 2 2L21 22.414l-2-2-2 2L15.586 21l2-2-2-2L17 15.586l2 2 2-2z" />
    <Path
      fillRule="evenodd"
      d="M22 4v9H4v5h8v2H2V4zM4 11h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRemoveRow;
