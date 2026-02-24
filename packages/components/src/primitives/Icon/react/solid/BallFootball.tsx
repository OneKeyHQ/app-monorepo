import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallFootball = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m16.028 10.691-1.538 4.736H9.51L7.972 10.69 12 7.764z" />
    <Path
      fillRule="evenodd"
      d="M12 2a9.98 9.98 0 0 1 7.807 3.75 9.96 9.96 0 0 1 2.182 6.717 9.95 9.95 0 0 1-1.633 5.027 10.02 10.02 0 0 1-5.715 4.154c-.843.23-1.728.352-2.641.352s-1.798-.122-2.64-.352a10.02 10.02 0 0 1-5.716-4.154A9.95 9.95 0 0 1 2 12c0-2.364.821-4.538 2.193-6.25A9.98 9.98 0 0 1 12 2m0 5.125L8.686 4.717A8 8 0 0 0 6.098 6.6l1.265 3.893L4.05 12.9a7.9 7.9 0 0 0 .988 3.044h4.097L10.4 19.84a8 8 0 0 0 3.2 0l1.265-3.896h4.097c.52-.917.865-1.946.988-3.044l-3.313-2.407L17.902 6.6a8 8 0 0 0-2.588-1.883z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBallFootball;
