// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
import browser from 'webextension-polyfill';

globalThis.browser = globalThis.browser || browser;
