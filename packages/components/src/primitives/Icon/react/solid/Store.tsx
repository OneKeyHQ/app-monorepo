import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgStore = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.557 10.293A4.51 4.51 0 0 0 19.095 12c.684 0 1.328-.15 1.905-.419V19a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-3a1.5 1.5 0 0 0-1.5-1.5h-1A1.5 1.5 0 0 0 10 17v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2v-7.419c.576.268 1.22.419 1.904.419a4.51 4.51 0 0 0 3.538-1.707A4.55 4.55 0 0 0 12 12c1.445 0 2.724-.67 3.557-1.707M7.417 7.66a2.52 2.52 0 1 1-5.006-.535l.344-2.408A2 2 0 0 1 4.734 3H7.75zm7.136-.403a2.56 2.56 0 1 1-5.107 0L9.75 3h4.5zM19.265 3a2 2 0 0 1 1.98 1.717l.343 2.408a2.519 2.519 0 1 1-5.005.535L16.25 3z" />
  </Svg>
);
export default SvgStore;
