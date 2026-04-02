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
      d="M18 18h1V8h3v10h1v2H1v-2h1V8h3v10h1V4h12zm-8 0h4v-3h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSchool;
