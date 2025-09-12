import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIcons = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M8 4a1 1 0 0 0-2 0zm-2 6a1 1 0 1 0 2 0zM4 6a1 1 0 0 0 0 2zm6 2a1 1 0 1 0 0-2zm9.828 7.585a1 1 0 0 0-1.414-1.414zm-5.657 2.829a1 1 0 0 0 1.415 1.414zm1.415-4.243a1 1 0 1 0-1.415 1.414zm2.828 5.657a1 1 0 0 0 1.414-1.414zM17 9a2 2 0 0 1-2-2h-2a4 4 0 0 0 4 4zm2-2a2 2 0 0 1-2 2v2a4 4 0 0 0 4-4zm-2-2a2 2 0 0 1 2 2h2a4 4 0 0 0-4-4zm0-2a4 4 0 0 0-4 4h2a2 2 0 0 1 2-2zM6 4v3h2V4zm0 3v3h2V7zM4 8h3V6H4zm3 0h3V6H7zm11.414 6.171-2.121 2.121 1.414 1.415 2.121-2.122zm-2.121 2.121-2.122 2.122 1.415 1.414 2.12-2.121zm-2.122-.707 2.122 2.122 1.414-1.415-2.122-2.12zm2.122 2.122 2.121 2.12 1.414-1.413-2.121-2.122zM5.5 15h3v-2h-3zm3.5.5v3h2v-3zM8.5 19h-3v2h3zM5 18.5v-3H3v3zm.5.5a.5.5 0 0 1-.5-.5H3A2.5 2.5 0 0 0 5.5 21zm3.5-.5a.5.5 0 0 1-.5.5v2a2.5 2.5 0 0 0 2.5-2.5zM8.5 15a.5.5 0 0 1 .5.5h2A2.5 2.5 0 0 0 8.5 13zm-3-2A2.5 2.5 0 0 0 3 15.5h2a.5.5 0 0 1 .5-.5z"
    />
  </Svg>
);
export default SvgIcons;
