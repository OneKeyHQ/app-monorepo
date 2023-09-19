import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgImageSquareAnimal = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m20 6.5-2.555 2.484a9.685 9.685 0 0 0-2.568.335 9.683 9.683 0 0 0-2.392.994L8.24 9.327l.879 4.864c-.324.944-.385 1.936-.126 2.902.308 1.148 1.025 2.102 2.008 2.803M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
    <Path
      fill="currentColor"
      d="M13.99 14.49c.183.684-.13 1.363-.7 1.516-.57.152-1.182-.279-1.365-.963-.183-.684.13-1.363.7-1.515.57-.153 1.181.278 1.365.962Zm6.194-1.66c.183.684-.13 1.363-.7 1.516-.57.152-1.181-.278-1.365-.963-.183-.684.13-1.362.7-1.515.57-.153 1.182.278 1.365.962Zm-2.115 3.665c.122.457-.334.975-1.018 1.158-.684.184-1.338-.037-1.46-.494-.123-.456.333-.974 1.017-1.157.684-.184 1.338.037 1.46.494Z"
    />
  </Svg>
);
export default SvgImageSquareAnimal;
