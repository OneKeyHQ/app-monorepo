import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPagesWide = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 13h2v2h-2v2h-2v-2h-2v-2h2v-2h2z" />
    <Path
      fillRule="evenodd"
      d="M18 8h4v12H6v-4H2V4h16zM8 18h12v-8H8zm-4-4h2V8h10V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPagesWide;
