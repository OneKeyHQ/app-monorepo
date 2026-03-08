import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageAnnotation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.002 19.036h-6.626l-3.382 2.802-3.343-2.802H2.002V3h20zM7.5 9.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageAnnotation;
