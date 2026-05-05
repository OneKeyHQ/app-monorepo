import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddSheet = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 2v20H4V2zm-9 9H8v2h3v3h2v-3h3v-2h-3V8h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddSheet;
