import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentAttach = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 22H4v-7.342A6 6 0 0 0 12 9V4.5c0-.925-.28-1.785-.758-2.5H20z" />
    <Path d="M7.5 2A2.5 2.5 0 0 1 10 4.5V9a4 4 0 0 1-8 0V4h2v5a2 2 0 1 0 4 0V4.5a.5.5 0 0 0-1 0V9H5V4.5A2.5 2.5 0 0 1 7.5 2" />
  </Svg>
);
export default SvgDocumentAttach;
