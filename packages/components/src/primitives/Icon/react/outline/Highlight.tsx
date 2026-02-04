import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHighlight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15.629 2.457a2 2 0 0 1 2.828 0l3.086 3.086a2 2 0 0 1 .137 2.676l-.137.152-13 13a2 2 0 0 1-1.414.586H3.043a1 1 0 0 1-1-1v-4.086a2 2 0 0 1 .586-1.414zM4.043 16.871v3.086h3.086l13-13-3.086-3.086z"
      clipRule="evenodd"
    />
    <Path d="M21.043 19.957a1 1 0 1 1 0 2h-7a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgHighlight;
