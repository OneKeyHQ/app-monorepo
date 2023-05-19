import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUserRemove = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-4 7a6 6 0 0 0-6 6v1h12v-1a6 6 0 0 0-6-6zm12-2h-6"
    />
  </Svg>
);
export default SvgUserRemove;
