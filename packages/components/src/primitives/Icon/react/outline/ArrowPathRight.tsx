import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.087 5.575c0-1.258 1.438-1.946 2.413-1.206l.092.076 6.854 6.048a2.01 2.01 0 0 1 0 3.014l-6.854 6.049c-.974.858-2.505.167-2.505-1.131V16.02H4.04c-1.11 0-2.01-.9-2.01-2.01V9.99c0-1.11.9-2.01 2.01-2.01h9.046V5.574ZM4.04 14.01h10.051c.555 0 1.005.45 1.005 1.005v2.296L21.116 12l-6.019-5.312v2.296c0 .555-.45 1.005-1.005 1.005H4.041v4.02Z" />
  </Svg>
);
export default SvgArrowPathRight;
