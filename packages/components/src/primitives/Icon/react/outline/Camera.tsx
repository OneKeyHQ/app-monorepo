import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCamera = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M13.965 3a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.965L8.37 3.89A2 2 0 0 1 10.035 3zM8.629 7.11A2 2 0 0 1 6.965 8H4v11h16V8h-2.965a2 2 0 0 1-1.592-.79l-.072-.1L13.965 5h-3.93L8.63 7.11Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCamera;
