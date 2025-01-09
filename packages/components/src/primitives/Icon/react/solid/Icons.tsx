import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 3a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2H8v2a1 1 0 1 1-2 0V8H4a1 1 0 0 1 0-2h2V4a1 1 0 0 1 1-1Zm10 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm2.828 12.585a1 1 0 1 0-1.414-1.414L17 15.585l-1.414-1.414a1 1 0 0 0-1.414 1.414L15.586 17l-1.414 1.414a1 1 0 1 0 1.414 1.414L17 18.414l1.414 1.414a1 1 0 0 0 1.414-1.414L18.414 17l1.414-1.415ZM5.5 13A2.5 2.5 0 0 0 3 15.5v3A2.5 2.5 0 0 0 5.5 21h3a2.5 2.5 0 0 0 2.5-2.5v-3A2.5 2.5 0 0 0 8.5 13h-3Z"
    />
  </Svg>
);
export default SvgIcons;
