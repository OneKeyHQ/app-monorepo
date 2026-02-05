import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentLink2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 2a2 2 0 0 1 2 2v5.342A6 6 0 0 0 12 15v3c0 1.537.577 2.939 1.527 4H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 9a1 1 0 0 0 0 2h2a1 1 0 1 0 0-2zm0-4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
    <Path d="M21 17a1 1 0 0 1 1 1 4 4 0 0 1-8 0 1 1 0 1 1 2 0 2 2 0 1 0 4 0 1 1 0 0 1 1-1" />
    <Path d="M18 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1" />
    <Path d="M18 11a4 4 0 0 1 4 4 1 1 0 1 1-2 0 2 2 0 1 0-4 0 1 1 0 1 1-2 0 4 4 0 0 1 4-4" />
  </Svg>
);
export default SvgDocumentLink2;
