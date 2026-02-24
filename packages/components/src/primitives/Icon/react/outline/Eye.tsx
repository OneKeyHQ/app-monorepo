import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 4c4.24 0 8.34 2.612 10.889 7.541l.237.46-.237.458C20.339 17.389 16.239 20 12 20c-4.24 0-8.34-2.612-10.889-7.541L.874 12l.237-.459c2.55-4.93 6.65-7.54 10.889-7.54Zm0 2c-3.228 0-6.586 1.913-8.864 6 2.278 4.087 5.636 6 8.864 6s6.585-1.913 8.863-6C18.585 7.913 15.228 6 12 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
