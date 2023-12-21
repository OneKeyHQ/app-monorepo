import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10.6 3.3c.989-.742 2.4-.036 2.4 1.2v15c0 1.236-1.411 1.942-2.4 1.2l-4.667-3.5a1 1 0 0 0-.6-.2H4a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1.333a1 1 0 0 0 .6-.2L10.6 3.3ZM19 8a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2V9a1 1 0 0 1 1-1Z"
    />
  </Svg>
);
export default SvgVolumeUp;
