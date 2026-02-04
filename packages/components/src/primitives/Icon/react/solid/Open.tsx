import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.568 3H9a1 1 0 0 1 0 2H5.6a8 8 0 0 0-.589.011v.014C5 5.14 5 5.303 5 5.6v12.8a8 8 0 0 0 .011.589h.014c.116.01.278.011.575.011h12.8c.297 0 .459 0 .575-.01l.014-.001v-.014c.01-.116.011-.279.011-.575V15a1 1 0 1 1 2 0v3.432c0 .252 0 .498-.017.706a2 2 0 0 1-.201.77 2 2 0 0 1-.874.874 2 2 0 0 1-.77.201c-.208.017-.454.017-.706.017H5.568c-.252 0-.498 0-.706-.017a2 2 0 0 1-.77-.201 2 2 0 0 1-.874-.874 2 2 0 0 1-.201-.77C3 18.93 3 18.684 3 18.432V5.568c0-.252 0-.498.017-.706a2 2 0 0 1 .201-.77 2 2 0 0 1 .874-.874 2 2 0 0 1 .77-.201C5.07 3 5.316 3 5.568 3M14 5a1 1 0 1 1 0-2h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V6.414l-7.293 7.293a1 1 0 0 1-1.414-1.414L17.586 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOpen;
