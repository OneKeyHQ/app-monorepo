import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3.002 4a1 1 0 0 1 1-1h16a1 1 0 0 1 0 2h-16a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h6.5a1 1 0 0 1 0 2h-6.5a1 1 0 0 1-1-1ZM4 11a1 1 0 1 0 0 2h3.002a1 1 0 1 0 0-2H4Zm15.258-2.293a3 3 0 0 0-4.242 0l-7.721 7.721a1 1 0 0 0-.293.707V21a1 1 0 0 0 1 1h3.865a1 1 0 0 0 .707-.293l7.72-7.72a3 3 0 0 0 0-4.244l-1.036-1.036Z"
    />
  </Svg>
);
export default SvgEditList;
