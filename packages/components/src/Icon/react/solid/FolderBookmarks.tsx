import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderBookmarks = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 6a3 3 0 0 1 3-3h3.93a3 3 0 0 1 2.496 1.336l.812 1.219A1 1 0 0 0 13.07 6H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-9v-6a3 3 0 0 0-3-3H2V6Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M1 15a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5a1 1 0 0 1-1.514.858L4.5 19.666l-1.986 1.192A1 1 0 0 1 1 20v-5Zm5 0H3v3.234l.986-.592a1 1 0 0 1 1.028 0l.986.592V15Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderBookmarks;
