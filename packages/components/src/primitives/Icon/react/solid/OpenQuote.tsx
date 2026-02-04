import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOpenQuote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.647 4.064A1 1 0 0 1 7.999 5v5h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-1.999v-7c0-2.586 1.162-4.336 2.316-5.418a8.2 8.2 0 0 1 2.098-1.42q.1-.045.16-.07l.049-.019.015-.007.006-.002h.002c.001.003.023.055.354.935zm11 0a1 1 0 0 1 1.352.935L19.002 10h1a2 2 0 0 1 2 2.001l-.002 6a2 2 0 0 1-2 2h-5.002a2 2 0 0 1-2-2v-7c0-2.586 1.163-4.336 2.317-5.418a8.2 8.2 0 0 1 2.098-1.42q.099-.045.159-.07l.05-.019.015-.007.006-.002h.002c.001.003.024.056.354.935z" />
  </Svg>
);
export default SvgOpenQuote;
