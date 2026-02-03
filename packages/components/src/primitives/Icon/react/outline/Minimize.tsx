import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMinimize = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.6 14.313v4.624h5.55v-4.625zm14.8-.926V5.063H5.525v4.625a.925.925 0 1 1-1.85 0V5.063a1.85 1.85 0 0 1 1.85-1.85H19.4a1.85 1.85 0 0 1 1.85 1.85v8.325a1.85 1.85 0 0 1-1.85 1.85h-4.625a.925.925 0 1 1 0-1.85zm-3.429-6.203a.925.925 0 1 1 1.308 1.308l-1.196 1.196h.542a.925.925 0 0 1 0 1.85H13.85a.925.925 0 0 1-.925-.925V7.838a.925.925 0 1 1 1.85 0v.542zM12 18.937a1.85 1.85 0 0 1-1.85 1.85H4.6a1.85 1.85 0 0 1-1.85-1.85v-4.625a1.85 1.85 0 0 1 1.85-1.85h5.55a1.85 1.85 0 0 1 1.85 1.85v4.626Z" />
  </Svg>
);
export default SvgMinimize;
