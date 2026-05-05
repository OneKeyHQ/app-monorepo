import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m7.64 12.138-1.366 1.784h5.724v3.519l.634-.866 1.502 1.335-4.136 5.65v-7.638H2.223l3.919-5.116 1.499 1.332Z" />
    <Path
      fillRule="evenodd"
      d="M13.998 7.547h7.722l-5.213 7.122 5.158 4.583-1.33 1.496-18-16 1.33-1.496 4.916 4.37L13.998.55zm-3.919 1.408 4.927 4.379 2.771-3.787h-5.779V6.45z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNoFlash;
