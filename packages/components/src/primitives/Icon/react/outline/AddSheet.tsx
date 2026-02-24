import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddSheet = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 11h3v2h-3v3h-2v-3H8v-2h3V8h2z" />
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h12V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddSheet;
