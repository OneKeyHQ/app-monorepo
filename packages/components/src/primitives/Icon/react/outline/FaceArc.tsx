import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFaceArc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.688 13.453c.067.13.137.248.214.367.683 1.058 1.875 1.658 3.1 1.655 1.225.006 2.417-.593 3.096-1.652.077-.119.145-.238.212-.367l1.38.588c-.07.188-.146.365-.237.545-.789 1.628-2.629 2.714-4.452 2.686-1.824.024-3.658-1.061-4.451-2.685a5 5 0 0 1-.238-.543zM9.25 8c.828 0 1.5.796 1.5 1.9 0 1.105-.672 1.85-1.5 1.85s-1.5-.745-1.5-1.85S8.422 8 9.25 8m5.5 0c.828 0 1.5.796 1.5 1.9 0 1.105-.672 1.85-1.5 1.85s-1.5-.745-1.5-1.85.672-1.9 1.5-1.9" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceArc;
