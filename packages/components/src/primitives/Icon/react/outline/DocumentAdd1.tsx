import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAdd1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12h-2V4H6v16h6v2H4V2h16z" />
    <Path d="M19 17h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
  </Svg>
);
export default SvgDocumentAdd1;
