import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.943 15 13 17.967v-5.933zM6.25 5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M16 2v6h6v14H8v-6H2V2zm-6 18h10V10H10zm-5.945-7.501q-.027.016-.055.031V14h4v-1.47l-.055-.031L6 11.201zM4 10.131l2-1.333 2 1.333V8h6V4H4v6.13Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultiMedia;
