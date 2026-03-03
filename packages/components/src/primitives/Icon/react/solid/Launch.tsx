import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLaunch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.633 3.442c2.1-1.19 4.817-1.699 8.44-1.44l.863.062.063.865c.259 3.622-.25 6.338-1.44 8.44-1.089 1.92-2.69 3.225-4.558 4.237v2.854l-4.975 4.264-.472-1.405-.002-.006-.01-.028a15 15 0 0 0-.2-.543 24 24 0 0 0-.6-1.425c-.526-1.142-1.216-2.378-1.948-3.11s-1.967-1.421-3.11-1.947a24 24 0 0 0-1.967-.801l-.029-.009-.005-.002h-.001l-1.405-.473L5.541 8h2.854c1.012-1.868 2.317-3.47 4.238-4.558M15.5 6.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path d="M7.914 19.5 5 22.414 3.586 21 6.5 18.086zm-2-2L2 21.414.586 20 4.5 16.086z" />
  </Svg>
);
export default SvgLaunch;
