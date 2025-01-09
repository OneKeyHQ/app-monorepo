import platformEnv from '../../platformEnv';

const nonStandardPropsKeys: {
  [type: string]: {
    [key: string]: boolean;
  };
} = {
  'button': {
    'borderCurve': true,
  },
  'div': {
    'borderCurve': true,
    'delayMs': true,
    'data-on-drag-start': true,
  },
};

// mute Errors like
// eslint-disable-next-line spellcheck/spell-checker
// Warning: React does not recognize the `borderCurve` prop on a DOM element. If you intentionally want it to appear in the DOM as a custom attribute, spell it as lowercase `bordercurve` instead. If you accidentally passed it from a parent component, remove it from the DOM element.
//      at button

export function filterReactWebElementNonStandardProps(
  type: string,
  props: Record<string, any>,
) {
  const standardProps = {};
  const nonStandardProps = {};

  //   return { standardProps: props, nonStandardProps };

  if (process.env.NODE_ENV !== 'production') {
    if (platformEnv.isRuntimeBrowser) {
      for (const key in props) {
        if (Object.prototype.hasOwnProperty.call(props, key)) {
          const isKeyNotStandard = nonStandardPropsKeys?.[type]?.[key];
          if (isKeyNotStandard) {
            // @ts-ignore
            nonStandardProps[key] = props[key];
          } else {
            // @ts-ignore
            standardProps[key] = props[key];
          }
        }
      }

      return { standardProps, nonStandardProps };
    }
  }

  return { standardProps: props, nonStandardProps };
}
