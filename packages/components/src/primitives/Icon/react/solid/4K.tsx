import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const Svg4K = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.865 12.878h-1.83v-.059l1.791-2.983h.04z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM5.34 12.717v1.665h3.467V15.5h1.953v-1.118h.864v-1.587h-.864v-4.34H7.898L5.34 12.716Zm7.07 2.783h2.07v-1.846l.552-.747L16.57 15.5h2.407l-2.426-3.92 2.32-3.126h-2.174l-2.177 2.988h-.04V8.454h-2.07z"
      clipRule="evenodd"
    />
  </Svg>
);
export default Svg4K;
