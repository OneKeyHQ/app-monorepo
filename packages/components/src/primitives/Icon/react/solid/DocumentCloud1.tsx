import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentCloud1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 13.168A6.25 6.25 0 0 0 11.167 22H4V2h16z" />
    <Path
      fillRule="evenodd"
      d="M15.75 13.5c1.319 0 2.492.602 3.269 1.538A3.5 3.5 0 0 1 18.5 22h-2.75a4.25 4.25 0 0 1 0-8.5m0 2a2.25 2.25 0 0 0 0 4.5h2.75a1.5 1.5 0 0 0 0-3h-.561l-.295-.46a2.24 2.24 0 0 0-1.894-1.04"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocumentCloud1;
