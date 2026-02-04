import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 13a1 1 0 0 1 1-1h3.922L12 3.855 3.078 12H7a1 1 0 0 1 1 1v6h8zm2 6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5H3.078c-1.825 0-2.696-2.245-1.348-3.476l8.922-8.147a2 2 0 0 1 2.697 0l8.922 8.147c1.348 1.23.477 3.476-1.349 3.476H18z" />
  </Svg>
);
export default SvgShift;
