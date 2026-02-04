import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.314 3.138c.756-1.284 2.614-1.284 3.37 0l8.065 13.71c.766 1.304-.173 2.946-1.685 2.946H3.934c-1.512 0-2.451-1.642-1.685-2.945zm1.684 5.905c.54 0 .978.438.978.978v1.954a.977.977 0 0 1-1.955 0v-1.954c0-.54.438-.978.977-.978m-1.221 5.864a1.222 1.222 0 1 1 2.443 0 1.222 1.222 0 0 1-2.443 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgError;
