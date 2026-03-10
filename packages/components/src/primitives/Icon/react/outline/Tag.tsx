import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTag = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M22.414 12 12 22.414l-10-10V2h10.414zM4 11.586l8 8L19.586 12l-8-8H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTag;
