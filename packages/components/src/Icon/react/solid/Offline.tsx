import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOffline = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.024 8.438c.021.198.057.393.107.581A3.5 3.5 0 0 0 5.5 16h7.086l-4.204-4.204a1.004 1.004 0 0 1-.168-.167l-3.19-3.191ZM15.115 15.7a4.502 4.502 0 0 0-2.23-8.66 4.002 4.002 0 0 0-7.393-.964l4.206 4.207a.895.895 0 0 1 .018.018l5.291 5.291.109.108Z"
    />
    <Path d="M3.707 2.293a1 1 0 0 0-1.414 1.414l6.921 6.922c.05.062.105.118.168.167l6.91 6.911a1 1 0 0 0 1.415-1.414l-6.99-6.99a.922.922 0 0 0-.02-.02l-6.99-6.99Z" />
  </Svg>
);
export default SvgOffline;
