import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageInfo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 13.75v-2m-.002 8.786 2.74-2.27a1 1 0 0 1 .638-.23h2.626a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-12a2 2 0 0 0-2 2v10.036a2 2 0 0 0 2 2h2.65a1 1 0 0 1 .642.233l2.704 2.267Z"
    />
    <Path
      fill="currentColor"
      d="M10.75 8.75a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Z"
    />
  </Svg>
);
export default SvgMessageInfo;
