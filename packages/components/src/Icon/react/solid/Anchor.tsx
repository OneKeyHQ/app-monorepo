import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnchor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M13 8.855A3.502 3.502 0 0 0 12 2a3.5 3.5 0 0 0-1 6.855v11.129A7.501 7.501 0 0 1 4.016 13H6a1 1 0 1 0 0-2H3a1 1 0 0 0-1 1v.5a9.5 9.5 0 0 0 9.5 9.5h1a9.5 9.5 0 0 0 9.5-9.5V12a1 1 0 0 0-1-1h-3a1 1 0 1 0 0 2h1.984A7.501 7.501 0 0 1 13 19.984V8.855ZM10.5 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnchor;
