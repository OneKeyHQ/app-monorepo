import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHd = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.398 10.1c.987 0 1.578.634 1.578 1.816v.01c0 1.299-.542 1.928-1.578 1.928h-.649V10.1z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM5.081 15.5h2.07v-2.725h2.48V15.5h2.071V8.454h-2.07v2.68h-2.48v-2.68H5.08V15.5Zm7.598 0h3.012c2.134 0 3.394-1.318 3.394-3.574v-.01c0-2.25-1.26-3.462-3.394-3.462H12.68z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHd;
