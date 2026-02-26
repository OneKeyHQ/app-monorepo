import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m24.198 9.911-9.94 4.348-4.347 9.94L1.836 1.835zm-14.11 8.89 2.496-5.701.156-.36.36-.156 5.702-2.495L5.164 5.164l4.925 13.638Z" />
  </Svg>
);
export default SvgCursor;
