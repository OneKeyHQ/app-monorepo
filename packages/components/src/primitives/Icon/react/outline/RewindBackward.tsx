import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRewindBackward = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.861 12.753 5.481 4.796c.647.566 1.659.107 1.659-.752V7.204c0-.86-1.012-1.318-1.659-.752l-5.481 4.796a1 1 0 0 0 0 1.505Zm-8 0 5.481 4.796c.647.566 1.659.107 1.659-.752V7.204c0-.86-1.012-1.318-1.659-.752l-5.481 4.796a1 1 0 0 0 0 1.505Z"
    />
  </Svg>
);
export default SvgRewindBackward;
