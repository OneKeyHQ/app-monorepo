// Use require() to load use-suspender to avoid .mjs module issues on React Native
const useSuspender = require('use-suspender') as typeof import('use-suspender');

export const createSuspender = useSuspender.createSuspender;
