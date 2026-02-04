import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageAnnotation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.5 9.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M20.002 3a2 2 0 0 1 2 2v12.036a2 2 0 0 1-2 2h-4.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-4.65a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-16 14.036h4.65a2 2 0 0 1 1.285.467L12 19.233l2.099-1.737c.359-.297.81-.46 1.276-.46h4.626V5h-16z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageAnnotation;
