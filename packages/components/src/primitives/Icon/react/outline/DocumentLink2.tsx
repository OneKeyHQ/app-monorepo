import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentLink2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 9h-2V4H6v16h6.5v2H4V2h16z" />
    <Path d="M16 18a2 2 0 1 0 4 0v-1h2v1a4 4 0 1 1-8 0v-1h2z" />
    <Path d="M19 18h-2v-3h2z" />
    <Path d="M18 11a4 4 0 0 1 4 4v1h-2v-1a2 2 0 1 0-4 0v1h-2v-1a4 4 0 0 1 4-4m-6 1H8v-2h4zm4-4H8V6h8z" />
  </Svg>
);
export default SvgDocumentLink2;
