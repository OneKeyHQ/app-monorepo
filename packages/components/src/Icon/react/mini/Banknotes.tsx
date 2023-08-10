import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBanknotes = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBanknotes;
