import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBank = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 3.724 4.049 7.7v.38H19.95V7.7zM4.434 19.012h15.132l-.331-.994H4.765l-.33.994Zm11.542-2.982h1.987v-5.963h-1.987zm-5.964 0h3.976v-5.963h-3.976zm-3.975 0h1.987v-5.963H6.037zm15.902-7.95c0 1.097-.89 1.987-1.988 1.987v6.097c.542.21.978.651 1.17 1.225l.33.994A1.988 1.988 0 0 1 19.567 21H4.434a1.988 1.988 0 0 1-1.886-2.617l.331-.994a1.99 1.99 0 0 1 1.17-1.225v-6.097A1.99 1.99 0 0 1 2.06 8.079V7.7c0-.752.425-1.44 1.099-1.777l7.95-3.976c.56-.28 1.22-.28 1.78 0l7.95 3.976a1.99 1.99 0 0 1 1.1 1.778v.38Z" />
  </Svg>
);
export default SvgBank;
