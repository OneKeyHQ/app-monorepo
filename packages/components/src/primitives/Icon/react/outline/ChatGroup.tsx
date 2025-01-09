import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChatGroup = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14h2.002a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-10a2 2 0 0 0-2 2v2m8 0h-10a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v2.5l4.5-2.5h4.5a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2Z"
    />
  </Svg>
);
export default SvgChatGroup;
