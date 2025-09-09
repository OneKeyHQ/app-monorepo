/**
 * LaunchOptionsManager Usage Example
 * 
 * This module provides access to iOS app launch options from React Native.
 * It's useful for handling deep links, push notifications, and other launch scenarios.
 */

import { launchOptionsManager } from './LaunchOptionsManager';

// Example 1: Get launch options when app starts
export const initializeApp = async () => {
  try {
    const launchOptions = await launchOptionsManager.initializeAndGetLaunchOptions();
    
    if (launchOptions) {
      console.log('App launched with options:', launchOptions);
      
      // Handle different launch scenarios
      if (launchOptions[UIApplicationLaunchOptionsURLKey]) {
        // App was launched via URL scheme
        const url = launchOptions[UIApplicationLaunchOptionsURLKey];
        console.log('App launched via URL:', url);
        // Handle deep link
      }
      
      if (launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey]) {
        // App was launched via push notification
        const notification = launchOptions[UIApplicationLaunchOptionsRemoteNotificationKey];
        console.log('App launched via push notification:', notification);
        // Handle push notification
      }
      
      if (launchOptions[UIApplicationLaunchOptionsLocalNotificationKey]) {
        // App was launched via local notification
        const notification = launchOptions[UIApplicationLaunchOptionsLocalNotificationKey];
        console.log('App launched via local notification:', notification);
        // Handle local notification
      }
    } else {
      console.log('App launched normally (no special options)');
    }
  } catch (error) {
    console.error('Failed to get launch options:', error);
  }
};

// Example 2: Check if launch options are available later
export const checkLaunchOptionsLater = () => {
  const cachedOptions = launchOptionsManager.getCachedLaunchOptions();
  
  if (cachedOptions) {
    console.log('Cached launch options:', cachedOptions);
  } else {
    console.log('No cached launch options available');
  }
};

// Example 3: Clear launch options after handling
export const clearLaunchOptions = async () => {
  try {
    const success = await launchOptionsManager.clearLaunchOptions();
    if (success) {
      console.log('Launch options cleared successfully');
    }
  } catch (error) {
    console.error('Failed to clear launch options:', error);
  }
};

// iOS Launch Options Keys (for reference)
const UIApplicationLaunchOptionsURLKey = 'UIApplicationLaunchOptionsURLKey';
const UIApplicationLaunchOptionsRemoteNotificationKey = 'UIApplicationLaunchOptionsRemoteNotificationKey';
const UIApplicationLaunchOptionsLocalNotificationKey = 'UIApplicationLaunchOptionsLocalNotificationKey';
const UIApplicationLaunchOptionsUserActivityTypeKey = 'UIApplicationLaunchOptionsUserActivityTypeKey';
const UIApplicationLaunchOptionsUserActivityDictionaryKey = 'UIApplicationLaunchOptionsUserActivityDictionaryKey';
