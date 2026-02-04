import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentCloud2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 2a2 2 0 0 1 2 2v6.5a1 1 0 1 1-2 0V4H6v16h3a1 1 0 1 1 0 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <Path
      fillRule="evenodd"
      d="M15.75 13.5c1.318 0 2.494.6 3.271 1.538A3.501 3.501 0 0 1 18.5 22h-2.75a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5h2.75a1.5 1.5 0 0 0 0-3h-.01a1 1 0 0 1-.843-.46 2.25 2.25 0 0 0-1.897-1.04"
      clipRule="evenodd"
    />
    <Path d="M11 10a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm4-4a1 1 0 1 1 0 2H9a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgDocumentCloud2;
