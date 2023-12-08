import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgTag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 11.172V5a2 2 0 0 1 2-2h6.172a2 2 0 0 1 1.414.586l7.75 7.75a2 2 0 0 1 0 2.828l-6.172 6.172a2 2 0 0 1-2.828 0l-7.75-7.75A2 2 0 0 1 3 11.172Z"
    />
    <Circle cx={7.5} cy={7.5} r={1.5} fill="currentColor" />
  </Svg>
);
export default SvgTag;
