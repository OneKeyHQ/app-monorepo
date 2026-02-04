import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentLink2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 2a2 2 0 0 1 2 2v4a1 1 0 1 1-2 0V4H6v16h5.5a1 1 0 1 1 0 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <Path d="M21 17a1 1 0 0 1 1 1 4 4 0 1 1-8 0 1 1 0 1 1 2 0 2 2 0 1 0 4 0 1 1 0 0 1 1-1" />
    <Path d="M18 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1" />
    <Path d="M18 11a4 4 0 0 1 4 4 1 1 0 1 1-2 0 2 2 0 1 0-4 0 1 1 0 1 1-2 0 4 4 0 0 1 4-4m-7-1a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgDocumentLink2;
