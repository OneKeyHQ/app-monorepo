import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHighlight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 21h7m-.414-15.914-1.672-1.672a2 2 0 0 0-2.828 0l-12.5 12.5A2 2 0 0 0 3 17.328V21h3.672a2 2 0 0 0 1.414-.586l12.5-12.5a2 2 0 0 0 0-2.828Z"
    />
  </Svg>
);
export default SvgHighlight;
