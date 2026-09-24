// Original OneKey chart icons: 24 px grid, 2 px strokes, square ends and corners.
// currentColor supports both web CSS masks and native SvgXml rendering.
// The compact chevron uses a 12 x 16 grid to fit the tool group affordance.
export const TRADING_VIEW_DRAWING_ICONS = {
  trend:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m7 17 10-10"/><path d="M3 17h4v4H3zM17 3h4v4h-4z"/></svg>',
  ray: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 17h4v4H3zM7 17 20 4"/><path d="M14 4h6v6"/></svg>',
  extended:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 15v5h5M15 4h5v5M4 20 20 4"/></svg>',
  horizontal:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 12h7m4 0h7M10 10h4v4h-4z"/></svg>',
  horizontalRay:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 10h4v4H3zM7 12h14m-4-4 4 4-4 4"/></svg>',
  vertical:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M12 3v7m0 4v7M10 10h4v4h-4z"/></svg>',
  cross:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 12h7m4 0h7M12 3v7m0 4v7M10 10h4v4h-4z"/></svg>',
  arrow:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 20 20 4M10 4h10v10"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 18 17 4M13 4h4v4M11 14h10v7H11zM14 17.5h4"/></svg>',
  angle:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M20 20H4L20 4M12 20a8 8 0 0 0-2.34-5.66"/></svg>',
  channel:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 14 13-11M8 21 21 10"/><path d="m6 17 3-2.54m2-1.69 3-2.54m2-1.69 3-2.54"/></svg>',
  fib: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 4h16M4 9h12M4 13h9M4 20h5M4 4v16"/></svg>',
  fibExtension:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 20 5-7 4 4 8-13M14 4h6v6M14 13h7M17 18h4"/></svg>',
  fibChannel:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 10 19 2M3 15 21 6M3 20 21 11M11 21 21 16"/></svg>',
  fibFan:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 20V3M4 20l7-17M4 20 20 4M4 20l17-7M4 20h17"/></svg>',
  fibTime:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 4v16M7 4v16M12 4v16M20 4v16M3 16h17"/></svg>',
  rectangle:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 5h18v14H3z"/><path d="M3 5h4v4H3zM17 15h4v4h-4z" fill="currentColor" stroke="none"/></svg>',
  ellipse:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><ellipse cx="12" cy="12" rx="9" ry="7"/><path d="M1 10h4v4H1zM19 10h4v4h-4z" fill="currentColor" stroke="none"/></svg>',
  triangle:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 20 12 4l8 16H4Z"/><path d="M10 2h4v4h-4z" fill="currentColor" stroke="none"/></svg>',
  brush:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m12 10 7-7 3 3-7 7-3-3ZM13 14c-1.5-1.5-4-1.2-5 .5S7 18 3 20c4 1 8 1 10-1s1.5-3.5 0-5Z"/></svg>',
  highlighter:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m9 11 8-8 4 4-8 8-4-4ZM9 11l-4 4 4 4 4-4M5 15l-2 4h6M13 21h9"/></svg>',
  text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 8V4h16v4M12 4v16M8 20h8"/></svg>',
  callout:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 4h18v13H9l-6 4V4ZM7 9h10M7 13h6"/></svg>',
  priceLabel:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 12 6-7h12v14H9l-6-7ZM11 9h6M11 15h6"/></svg>',
  priceRange:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 3h16M4 21h16M12 7v10M8 11l4-4 4 4M8 13l4 4 4-4"/></svg>',
  dateRange:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 4v16M21 4v16M7 12h10M11 8l-4 4 4 4M13 8l4 4-4 4"/></svg>',
  datePriceRange:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 9V3h6M15 21h6v-6M7 17 17 7M11 7h6v6M7 11v6h6"/></svg>',
  cursor:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M12 3v5m0 8v5M3 12h5m8 0h5"/><path d="M11 11h2v2h-2z" fill="currentColor" stroke="none"/></svg>',
  undo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  redo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m15 4 5 5-5 5M20 9h-10a6 6 0 0 0 0 12h3"/></svg>',
  magnet:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M4 4h5v9a3 3 0 0 0 6 0V4h5v9a8 8 0 0 1-16 0V4ZM4 9h5m6 0h5"/></svg>',
  lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>',
  unlock:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0M12 14v3"/></svg>',
  hide: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  show: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 3 18 18M9 5.5c1-.3 2-.5 3-.5 6 0 10 7 10 7s-1.1 1.9-3 3.8M5.2 8.2C3.2 10.1 2 12 2 12s4 7 10 7c1 0 2-.2 3-.5M9 12a3 3 0 0 0 3 3"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>',
  stay: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 13 10-10 4 4L7 17H3v-4ZM10 6l4 4M4 21h10a6 6 0 0 0 6-6v-3m-3 3 3-3 3 3"/></svg>',
  chevron:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 16" width="12" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 3 5 5-5 5"/></svg>',
  objects:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="m3 7 9-4 9 4-9 4-9-4ZM3 12l9 4 9-4M3 17l9 4 9-4"/></svg>',
  data: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"><path d="M3 3h18v18H3zM3 9h18M9 9v12M12 13h6m-6 4h6"/></svg>',
} as const;
