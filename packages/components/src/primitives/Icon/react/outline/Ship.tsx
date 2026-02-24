import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 6h4v5.72l2.102.525-.11.879c-.255 2.04-.711 3.677-1.774 5.455l2.975.662-.434 1.952-5.259-1.169-4.283.953-.217.047-.217-.047-4.283-.953-5.259 1.17-.434-1.953 2.974-.662c-1.063-1.778-1.518-3.415-1.773-5.455l-.11-.879L5 11.72V6h4V2h6zm-9.879 7.749c.275 1.604.744 2.881 1.712 4.338l.02.031.647-.142.217.047 4.283.952 4.283-.952.217-.047.645.142.022-.031c.968-1.457 1.436-2.734 1.71-4.338L12 12.03zM7 11.219l4.758-1.189.242-.06.242.061L17 11.22V8H7v3.22ZM11 6h2V4h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShip;
