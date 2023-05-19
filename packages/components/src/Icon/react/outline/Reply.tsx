import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgReply = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6 6-6"
    />
  </Svg>
);
export default SvgReply;
