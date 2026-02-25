import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 2a5 5 0 0 1 4.453 7.273 4 4 0 0 1 2.345 4.976A3.5 3.5 0 0 1 18.5 21h-13a3.5 3.5 0 0 1-1.299-6.751 4 4 0 0 1 2.053-4.85A4 4 0 0 1 10 4h2V2.001zm1 4h-4a2 2 0 0 0-1.733 2.999l.005.01H10v2H7.823A2 2 0 0 0 6 13c0 .367.098.704.269.995L6.27 14H13v2H5.5a1.5 1.5 0 0 0 0 3h13a1.5 1.5 0 0 0 0-3H16v-2h1.729l.002-.005c.171-.291.269-.628.269-.995a2 2 0 0 0-2-2h-3V9h2.242l.1-.125A3 3 0 0 0 14 4.174z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShit;
