import { useState } from 'react';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

function stringifyOptions(options: Record<string, string | boolean | number>) {
    return Object.keys(options).reduce((acc, key) => {
      if (key === 'days') {
        return acc;
      } else {
        if (options[key] === false) {
          return acc;
        } else if (options[key] === true) {
          return `${acc}; ${key}`;
        } else {
          return `${acc}; ${key}=${options[key]}`;
        }
      }
    }, '');
  }
  
const setCookie = (name: string, value: string, options: Record<string, string | boolean>) => {
    if (!isBrowser) return;
  
    const optionsWithDefaults = {
      days: 7,
      path: '/',
      ...options,
    };
  
    const expires = new Date(
      Date.now() + optionsWithDefaults.days * 864e5
    ).toUTCString();
  
    document.cookie =
      name +
      '=' +
      encodeURIComponent(value) +
      '; expires=' +
      expires +
      stringifyOptions(optionsWithDefaults);
  };
  
const getCookie = (name: string, initialValue = '') => {
    return (
      (isBrowser &&
        document.cookie.split('; ').reduce((r, v) => {
          const parts = v.split('=');
          return parts[0] === name ? decodeURIComponent(parts[1]) : r;
        }, '')) ||
      initialValue
    );
  };
  
export default function (key: string, initialValue: string) {
    const [item, setItem] = useState(() => {
        return getCookie(key, initialValue);
    });

    const updateItem = (value: string, options: Record<string, string>) => {
        setItem(value);
        setCookie(key, value, options);
    };

    return [item, updateItem];
}