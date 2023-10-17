import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m14 9-2 2m0 0-2 2m2-2-2-2m2 2 2 2m-2.002 7.536 2.74-2.27a1 1 0 0 1 .638-.23h2.626a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-12a2 2 0 0 0-2 2v10.036a2 2 0 0 0 2 2h2.65a1 1 0 0 1 .642.233l2.704 2.267Z"
    />
  </Svg>
);
export default SvgMessageX;
