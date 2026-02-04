import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAttach = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 20v-4a1 1 0 1 1 2 0v4h12V4h-5a1 1 0 1 1 0-2h5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2M2 9V5a1 1 0 0 1 2 0v4a2 2 0 1 0 4 0V4.5a.5.5 0 0 0-1 0V9a1 1 0 0 1-2 0V4.5a2.5 2.5 0 0 1 5 0V9a4 4 0 0 1-8 0" />
  </Svg>
);
export default SvgDocumentAttach;
