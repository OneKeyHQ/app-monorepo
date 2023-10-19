import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVolumeOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10.6 3.3c.989-.742 2.4-.036 2.4 1.2v15c0 1.236-1.411 1.942-2.4 1.2l-4.667-3.5a1 1 0 0 0-.6-.2H4a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1.333a1 1 0 0 0 .6-.2L10.6 3.3Zm11.607 5.993a1 1 0 0 1 0 1.414l-1.414 1.414 1.414 1.415a1 1 0 0 1-1.414 1.414l-1.414-1.414-1.415 1.414a1 1 0 1 1-1.414-1.414l1.414-1.415-1.414-1.414a1 1 0 0 1 1.414-1.414l1.415 1.414 1.414-1.414a1 1 0 0 1 1.414 0Z"
    />
  </Svg>
);
export default SvgVolumeOff;
