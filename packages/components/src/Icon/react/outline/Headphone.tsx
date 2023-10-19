import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHeadphone = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 14v-2a8 8 0 1 1 16 0v2M4 14v4a2 2 0 1 0 4 0v-2a2 2 0 0 0-2-2H4Zm16 0v4a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2h2Z"
    />
  </Svg>
);
export default SvgHeadphone;
