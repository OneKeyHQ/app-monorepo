import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOnekey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillOpacity={0.875}
      d="M12 16.751a1.905 1.905 0 1 0 0-3.81 1.905 1.905 0 0 0 0 3.81Z"
    />
    <Path
      fill="currentColor"
      fillOpacity={0.875}
      fillRule="evenodd"
      d="M12 23c7.594 0 11-3.406 11-11 0-7.594-3.406-11-11-11C4.406 1 1 4.406 1 12c0 7.594 3.406 11 11 11ZM9.934 5.664h3.06v5.043h-1.897v-3.42h-1.7l.537-1.623ZM12 18.336a3.49 3.49 0 1 0 0-6.98 3.49 3.49 0 0 0 0 6.98Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOnekey;
