import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAutoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 7.547h7.722L10 23.559v-7.637H2.225L14 .55zm-7.724 6.375H12v3.518l5.78-7.893H12V6.449zM23.5 23h-2.1l-.28-1.5h-3.36L16.8 23h-2.402l5.802-9h1.35zm-4.454-3.5h1.645l-.41-1.92z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAutoFlash;
