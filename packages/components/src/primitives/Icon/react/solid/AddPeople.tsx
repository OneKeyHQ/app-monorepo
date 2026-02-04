import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.616 6.544a4.464 4.464 0 1 1 8.928 0 4.464 4.464 0 0 1-8.928 0M12.08 12c-4.72 0-8.02 3.493-8.428 7.843a.99.99 0 0 0 .987 1.085h10.417a2.976 2.976 0 0 1 0-5.952c0-.818.33-1.559.864-2.096-1.124-.563-2.418-.88-3.84-.88" />
    <Path d="M19.024 14.976a.992.992 0 1 0-1.984 0v1.984h-1.984a.992.992 0 0 0 0 1.984h1.984v1.984a.992.992 0 0 0 1.984 0v-1.984h1.984a.992.992 0 1 0 0-1.984h-1.984z" />
  </Svg>
);
export default SvgAddPeople;
