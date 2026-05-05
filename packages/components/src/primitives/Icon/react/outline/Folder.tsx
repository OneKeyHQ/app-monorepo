import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolder = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.535 6H22v14H2V3h8.535zM4 18h16V8h-8.535l-2-3H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolder;
