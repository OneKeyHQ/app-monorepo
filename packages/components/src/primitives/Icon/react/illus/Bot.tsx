import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

const SvgBot = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#8897A5"
      d="M11 2a1 1 0 1 1 2 0v1.8l1.6 1.6a1 1 0 1 1-1.4 1.4L12 5.6l-1.2 1.2a1 1 0 0 1-1.4-1.4L11 3.8z"
    />
    <Rect x="3" y="6" width="18" height="14" rx="5" fill="#3FA9F5" />
    <Rect x="1.5" y="10" width="3" height="6" rx="1.5" fill="#8897A5" />
    <Rect x="19.5" y="10" width="3" height="6" rx="1.5" fill="#8897A5" />
    <Circle cx="9" cy="12" r="1.5" fill="#10243E" />
    <Circle cx="15" cy="12" r="1.5" fill="#10243E" />
    <Path
      fill="#10243E"
      d="M8.5 15.4c.9.8 2.08 1.2 3.5 1.2s2.6-.4 3.5-1.2c.24-.2.6-.18.8.06.2.23.17.6-.06.8-1.14.98-2.58 1.46-4.24 1.46s-3.1-.48-4.24-1.46a.58.58 0 0 1-.06-.8c.2-.24.56-.26.8-.06"
    />
  </Svg>
);

export default SvgBot;
