import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAdd1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 2v9h-5v3h-3v6h3v2H4V2z" />
    <Path d="M19 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3z" />
  </Svg>
);
export default SvgDocumentAdd1;
