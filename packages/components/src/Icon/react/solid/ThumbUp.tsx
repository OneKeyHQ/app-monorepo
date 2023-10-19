import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 2a1 1 0 0 0-.894.553L6.382 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h13.381a4 4 0 0 0 3.964-3.46l.681-5A4 4 0 0 0 18.063 8h-3.879l.396-2.538A3 3 0 0 0 11.616 2H11ZM6 19v-7H4v7h2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbUp;
