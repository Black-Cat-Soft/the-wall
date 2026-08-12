// Centralized branding - change app name/copy here when rebranding
export const BRANDING = {
  // App identity
  APP_NAME: 'Stray',
  TAGLINE: 'find · bump · share',
  
  // Connection actions
  ACTION_CONNECT: 'Bump',
  ACTION_CONNECTED: 'Bumped',
  ACTION_CONNECTING: 'Bumping',
  
  // Screen titles
  FEED_TITLE: 'Your Wall',
  PROFILE_TITLE: 'Profile',
  CONNECT_SCREEN_TITLE: 'Bump Somebody',
  
  // Connection states
  STATUS_READY: 'Ready to Bump',
  STATUS_SCANNING: 'Scanning',
  STATUS_FOUND: 'Found',
  STATUS_CONFIRMED: 'Bumped',
  
  // Hints/Instructions
  HINT_BRING_PHONES: 'Bring phones together',
  HINT_TAP_TO_CONNECT: 'Bring the phones close, then tap Bump',
  HINT_CONNECTED: `Connected! Their posts appear on your wall.`,
  HINT_SIMULATE: 'Open this screen on both iPhones',
  
  // Backend
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
} as const;
