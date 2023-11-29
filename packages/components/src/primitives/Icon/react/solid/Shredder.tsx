import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShredder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2a3 3 0 0 0-3 3v5h16V5a3 3 0 0 0-3-3H7ZM3 12a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Zm4 5a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2Zm4 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4Zm4 0a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2Zm4 0a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0v-4Z"
    />
  </Svg>
);
export default SvgShredder;
