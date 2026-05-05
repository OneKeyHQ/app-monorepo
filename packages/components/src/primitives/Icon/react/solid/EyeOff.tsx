import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEyeOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 21 21 22.414l-3.798-3.797c-2.65 1.477-5.624 1.777-8.42.868-3.04-.987-5.78-3.37-7.67-7.026L.873 12l.237-.46c1.087-2.1 2.453-3.78 3.997-5.018L1.586 3 3 1.586zM8.554 9.968a4 4 0 0 0 5.477 5.478l-1.513-1.513a2 2 0 0 1-2.45-2.451z"
      clipRule="evenodd"
    />
    <Path d="M12 4c4.239 0 8.338 2.611 10.888 7.54l.238.46-.238.459c-.73 1.409-1.585 2.629-2.534 3.652L8.763 4.52A10.4 10.4 0 0 1 12 4" />
  </Svg>
);
export default SvgEyeOff;
