import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 16 16"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fill="#325FFA"
      fillRule="evenodd"
      d="M10.667 5.999V2.665h.667c.367 0 .667-.3.667-.666 0-.367-.3-.667-.667-.667H4.667c-.366 0-.666.3-.666.667 0 .366.3.666.666.666h.667V6c0 1.106-.893 2-2 2v1.333h3.98v4.667l.667.666.666-.666V9.332h4.02V7.999c-1.106 0-2-.894-2-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPin;
