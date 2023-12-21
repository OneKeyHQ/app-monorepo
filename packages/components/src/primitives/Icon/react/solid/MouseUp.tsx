import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMouseUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 12a6 6 0 1 1 12 0v5a6 6 0 0 1-12 0v-5Zm7-1a1 1 0 1 0-2 0v2a1 1 0 1 0 2 0v-2ZM8.168 4.555a1 1 0 0 0 1.387.277l1.89-1.26a1 1 0 0 1 1.11 0l1.89 1.26a1 1 0 0 0 1.11-1.664l-1.89-1.26a3 3 0 0 0-3.33 0l-1.89 1.26a1 1 0 0 0-.277 1.387Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMouseUp;
