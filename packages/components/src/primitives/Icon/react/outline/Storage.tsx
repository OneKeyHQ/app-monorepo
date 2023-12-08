import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStorage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 4h10V2H7v2Zm11 1v14h2V5h-2Zm-1 15H7v2h10v-2ZM6 19V5H4v14h2Zm1-3h10v-2H7v2Zm-3 1v1h2v-1H4Zm14 0v1h2v-1h-2Zm-1-1a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM7 14a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1v-2Zm0 6a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3v-2Zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V2Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.5}
      d="M15.25 18a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm-3 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"
    />
  </Svg>
);
export default SvgStorage;
