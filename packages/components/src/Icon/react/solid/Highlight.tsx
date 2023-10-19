import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHighlight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.379 2.707a3 3 0 0 1 4.242 0l1.672 1.672a3 3 0 0 1 0 4.242l-12.5 12.5A3 3 0 0 1 6.672 22H3a1 1 0 0 1-1-1v-3.672a3 3 0 0 1 .879-2.121l12.5-12.5ZM14 20a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2h-7Z"
    />
  </Svg>
);
export default SvgHighlight;
