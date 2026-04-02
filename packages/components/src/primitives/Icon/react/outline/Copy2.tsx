import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCopy2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 8h6v6h1v2h-1v6H2V8h6V7h2zM4 20h10V10H4z"
      clipRule="evenodd"
    />
    <Path d="M22 16h-4v-2h2v-2h2zm0-5h-2V7h2zM12 4h-2v2H8V2h4zm10 2h-2V4h-2V2h4zm-5-2h-4V2h4z" />
  </Svg>
);
export default SvgCopy2;
