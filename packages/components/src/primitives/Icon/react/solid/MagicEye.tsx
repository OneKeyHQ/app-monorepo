import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.001 4c4.24 0 8.338 2.612 10.888 7.541l.238.459-.238.459C20.339 17.389 16.24 19.999 12 20c-4.24 0-8.34-2.612-10.889-7.541L.875 12l.237-.459C3.662 6.611 7.762 4 12.001 4M10.6 10.6l-2.6 1v.8l2.6 1 1 2.6h.8l1-2.6 2.6-1v-.8l-2.6-1-1-2.6h-.8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagicEye;
