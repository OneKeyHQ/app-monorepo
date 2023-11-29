import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageExclamation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8.5v2m-.002 10.036 2.74-2.27a1 1 0 0 1 .638-.23h2.626a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-12a2 2 0 0 0-2 2v10.036a2 2 0 0 0 2 2h2.65a1 1 0 0 1 .642.233l2.704 2.267Z"
    />
    <Path
      fill="currentColor"
      d="M10.75 13.5a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0Z"
    />
  </Svg>
);
export default SvgMessageExclamation;
