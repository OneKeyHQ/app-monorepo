import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPagesWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 4v4h4v12H6v-4H2V4zm-5 7v2h-2v2h2v2h2v-2h2v-2h-2v-2zm-9 3h2V8h10V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPagesWide;
