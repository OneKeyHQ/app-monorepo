import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCubeView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 19a1 1 0 0 1-1-1v-2a1 1 0 1 0-2 0v2a3 3 0 0 0 3 3h2a1 1 0 1 0 0-2H6ZM3 8a1 1 0 1 0 2 0V6a1 1 0 0 1 1-1h2a1 1 0 1 0 0-2H6a3 3 0 0 0-3 3v2Zm13 11a1 1 0 1 0 0 2h2a3 3 0 0 0 3-3v-2a1 1 0 1 0-2 0v2a1 1 0 0 1-1 1h-2Zm0-16a1 1 0 1 0 0 2h2a1 1 0 0 1 1 1v2a1 1 0 1 0 2 0V6a3 3 0 0 0-3-3h-2Zm-4 7.848 3.5-2-.008-.004-2.5-1.429a2 2 0 0 0-1.984 0l-2.5 1.429-.008.004 3.5 2Zm1 1.732 3.5-2v2.84a2 2 0 0 1-1.008 1.736L13 16.58v-4Zm-2 0v4l-2.492-1.424A2 2 0 0 1 7.5 13.42v-2.84l3.5 2Z"
    />
  </Svg>
);
export default SvgCubeView;
