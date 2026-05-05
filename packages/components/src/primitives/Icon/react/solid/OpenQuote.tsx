import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOpenQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.003 10h3.002l-.006 10H2v-9c0-2.585 1.162-4.335 2.316-5.417a8.2 8.2 0 0 1 1.569-1.15 7 7 0 0 1 .69-.34l.048-.02.016-.006.006-.002h.001l.001-.002S6.65 4.063 7 5l-.353-.937L8 3.558zM19 10h3v10h-9v-9c0-2.585 1.162-4.335 2.316-5.417a8.2 8.2 0 0 1 1.569-1.15 7 7 0 0 1 .688-.34l.05-.02.016-.006.006-.002h.002v-.002s.002 0 .353.937l-.352-.937L19 3.557z" />
  </Svg>
);
export default SvgOpenQuote;
