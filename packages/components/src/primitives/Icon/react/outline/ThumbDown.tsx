import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 14h-4.38l-3.972 8h-1.233a3 3 0 0 1-2.958-3.462L9.852 16H5.99c-2.421 0-4.279-2.143-3.953-4.54l.68-5A3.99 3.99 0 0 1 6.669 3H22zM6.67 5c-.992 0-1.836.736-1.97 1.73l-.68 5A1.997 1.997 0 0 0 5.99 14h6.197l-.753 4.846a.997.997 0 0 0 .974 1.153L16 12.766V5zM18 12h2V5h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbDown;
