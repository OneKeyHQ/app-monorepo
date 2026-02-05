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
      d="M4.002 3h16a2 2 0 0 1 2 2v12.036a2 2 0 0 1-2 2h-4.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-4.65a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m2.248 8a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m4.5 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0m5.75 1.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageAnnotation;
