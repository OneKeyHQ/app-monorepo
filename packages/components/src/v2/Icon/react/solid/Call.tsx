import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 3C4.383 3 2.91 4.344 3.132 6.12c.958 7.695 7.055 13.791 14.75 14.75 1.776.22 3.12-1.251 3.12-2.87v-1.312a3 3 0 0 0-2.138-2.873l-1.531-.46a2.825 2.825 0 0 0-2.81.709c-.266.266-.609.283-.826.149a12.067 12.067 0 0 1-3.908-3.908c-.135-.218-.118-.56.149-.827a2.825 2.825 0 0 0 .708-2.81l-.46-1.53A3 3 0 0 0 7.313 3H6.001Z"
    />
  </Svg>
);
export default SvgCall;
