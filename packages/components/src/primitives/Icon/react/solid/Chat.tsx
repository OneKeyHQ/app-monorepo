import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.002 3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H12.28l-4.762 2.858A1 1 0 0 1 6.002 21v-2h-1a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h14Z"
    />
  </Svg>
);
export default SvgChat;
