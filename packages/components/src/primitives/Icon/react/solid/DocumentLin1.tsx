import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentLin1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 9.342A6 6 0 0 0 12 15v3c0 1.537.577 2.939 1.527 4H4V2h16z" />
    <Path d="M16 18a2 2 0 1 0 4 0v-1h2v1a4 4 0 0 1-8 0v-1h2z" />
    <Path d="M19 15v3h-2v-3z" />
    <Path d="M18 11a4 4 0 0 1 4 4v1h-2v-1a2 2 0 1 0-4 0v1h-2v-1a4 4 0 0 1 4-4" />
  </Svg>
);
export default SvgDocumentLin1;
