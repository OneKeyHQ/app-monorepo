import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 14a2 2 0 1 0-4 0 2 2 0 0 0 4 0m0-9h-4v2h4zm2 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 5a2 2 0 0 1 2-2h11.586A2 2 0 0 1 18 3.586L20.414 6A2 2 0 0 1 21 7.414V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm2 14h14V7.414L16.586 5H16v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5H5z" />
  </Svg>
);
export default SvgDisk2;
