import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 14v5h6v-5zm6-9H9v2h6zM3 5a2 2 0 0 1 2-2h11.586A2 2 0 0 1 18 3.586L20.414 6A2 2 0 0 1 21 7.414V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 14h2v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5h2V7.414l-2-2V7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5H5z" />
  </Svg>
);
export default SvgDisk1;
