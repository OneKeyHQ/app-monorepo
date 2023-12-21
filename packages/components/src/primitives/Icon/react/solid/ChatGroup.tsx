import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChatGroup = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19.002 3a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3h-4.24l-4.274 2.374a1 1 0 0 1-1.486-.874V19a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V6a3 3 0 0 1 3-3h10Zm-11 4h7a3 3 0 0 1 3 3v3h1a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatGroup;
