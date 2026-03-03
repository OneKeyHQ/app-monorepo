import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandPinch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.055 3.313c1.077-.645 2.455-.262 3.078.856l2.254 4.048 4.88-2.921c1.617-.968 3.685-.394 4.619 1.283l1.03 1.85c2.231 4.008.907 9.134-2.958 11.448a7.84 7.84 0 0 1-8.352-.17L4.5 15.715l.204-1.388c.187-1.276 1.337-2.153 2.567-1.959l1.34.211-3.382-6.072c-.622-1.118-.252-2.547.826-3.193ZM3.793 7.178l-.36.932c-.578 1.493-.578 2.787 0 4.28l.36.932-1.865.72-.36-.932c-.757-1.956-.757-3.764 0-5.72l.36-.933z" />
  </Svg>
);
export default SvgHandPinch;
