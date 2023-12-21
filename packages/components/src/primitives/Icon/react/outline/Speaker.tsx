import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeaker = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10 6a1 1 0 0 0 0 2V6Zm4 2a1 1 0 1 0 0-2v2ZM7 4h10V2H7v2Zm11 1v14h2V5h-2Zm-1 15H7v2h10v-2ZM6 19V5H4v14h2Zm1 1a1 1 0 0 1-1-1H4a3 3 0 0 0 3 3v-2Zm11-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2ZM17 4a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM7 2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V2Zm7 12a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4h-2Zm-2 2a2 2 0 0 1-2-2H8a4 4 0 0 0 4 4v-2Zm-2-2a2 2 0 0 1 2-2v-2a4 4 0 0 0-4 4h2Zm2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4v2Zm-2-4h4V6h-4v2Z"
    />
  </Svg>
);
export default SvgSpeaker;
