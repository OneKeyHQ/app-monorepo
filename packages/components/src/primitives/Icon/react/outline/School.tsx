import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSchool = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 8h4v10h1v2H1v-2h1V8h4V4h12zM4 18h2v-8H4zm4 0h1v-4h6v4h1V6H8zm10 0h2v-8h-2zm-7 0h2v-2h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSchool;
