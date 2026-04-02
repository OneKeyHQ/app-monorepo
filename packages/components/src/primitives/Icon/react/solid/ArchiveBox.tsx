import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchiveBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m10.914 2 2 2H19v4h2v13H3V8h2V2zM7 12v2h6v-2zm0-4h10V6h-4.914l-2-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchiveBox;
