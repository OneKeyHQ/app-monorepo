import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgInbox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7M4 13h4.126a4.002 4.002 0 0 0 7.748 0H20"
    />
  </Svg>
);
export default SvgInbox;
