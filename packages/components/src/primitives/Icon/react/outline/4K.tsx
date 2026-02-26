import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const Svg4K = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.76 12.795h.864v1.587h-.864V15.5H8.807v-1.118H5.34v-1.665l2.558-4.263h2.862v4.34Zm-3.726.024v.059h1.831V9.836h-.039z"
      clipRule="evenodd"
    />
    <Path d="M14.48 11.442h.04l2.177-2.988h2.173l-2.32 3.125 2.427 3.921H16.57l-1.538-2.593-.552.747V15.5h-2.07V8.454h2.07z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default Svg4K;
