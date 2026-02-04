import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHead = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 10a8 8 0 0 1 8-8c3.162 0 6.221 1.535 7.486 4.769.575 1.468 1.306 2.455 2.24 3.793.666.953.366 2.25-.61 2.836L19 14.066V17a2 2 0 0 1-2 2h-2v1a2 2 0 0 1-2 2H8c-1.108 0-1.998-.9-1.997-2.001.001-2.058-.103-3.538-1.3-5.065A7.97 7.97 0 0 1 3 10m2 0a5.97 5.97 0 0 0 1.276 3.7c1.648 2.1 1.728 4.193 1.727 6.3H13v-1a2 2 0 0 1 2-2h2v-2.934a2 2 0 0 1 .97-1.714l1.104-.665c-.895-1.28-1.776-2.466-2.45-4.19C15.726 5.201 13.538 4 11 4a6 6 0 0 0-6 6" />
  </Svg>
);
export default SvgHead;
