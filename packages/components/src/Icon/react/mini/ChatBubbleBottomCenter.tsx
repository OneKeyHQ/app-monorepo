import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChatBubbleBottomCenter = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
    <Path
      fillRule="evenodd"
      d="M3.43 2.524A41.29 41.29 0 0 1 10 2c2.236 0 4.43.18 6.57.524 1.437.231 2.43 1.49 2.43 2.902v5.148c0 1.413-.993 2.67-2.43 2.902a41.102 41.102 0 0 1-3.55.414.785.785 0 0 0-.643.413l-1.712 3.293a.75.75 0 0 1-1.33 0l-1.713-3.293a.783.783 0 0 0-.642-.413 41.108 41.108 0 0 1-3.55-.414C1.993 13.245 1 11.986 1 10.574V5.426c0-1.413.993-2.67 2.43-2.902z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatBubbleBottomCenter;
