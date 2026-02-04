import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.415 22a2.998 2.998 0 0 1-2.958-3.462L9.852 16H5.99c-2.421 0-4.279-2.143-3.953-4.54l.68-5A3.99 3.99 0 0 1 6.669 3H20a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2.38l-3.424 6.895-.066.125a1.99 1.99 0 0 1-1.715.98M16 12.767V5H6.67c-.992 0-1.836.736-1.97 1.73l-.68 5A1.997 1.997 0 0 0 5.99 14h5.03a1 1 0 0 1 .987 1.153l-.573 3.693A.998.998 0 0 0 12.409 20zM20 5h-2v7h2z" />
  </Svg>
);
export default SvgThumbDown;
