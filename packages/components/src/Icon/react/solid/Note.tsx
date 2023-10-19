import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7.672a3 3 0 0 1-.879 2.12l-4.328 4.33a3 3 0 0 1-2.121.878H6a3 3 0 0 1-3-3V6Zm9 13a1 1 0 0 0 1-1v-2a3 3 0 0 1 3-3h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNote;
