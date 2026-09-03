export const ROUTE = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ONBOARDING: '/onboarding',
  COURSES: '/courses',
  LOGIN: '/login',
  SIGN_UP: '/signup',
  INVITE: '/invite',
  PROFILE: '/profile',
  PEOPLE: '/people',
  FORGOT: '/forgot',
  RESET: '/reset',
  LOGOUT: '/logout',
  AUTH_FAILED: '/auth-failed',
  VERIFY_EMAIL_ERROR: '/verify-email-error'
};

export const PUBLIC_ROUTES = [
  `^${ROUTE.HOME}$`,
  ROUTE.LOGIN,
  ROUTE.LOGOUT,
  ROUTE.SIGN_UP,
  `^${ROUTE.INVITE}/.*`,
  ROUTE.FORGOT,
  ROUTE.RESET,
  '/404',
  `^${ROUTE.VERIFY_EMAIL_ERROR}$`,
  ROUTE.AUTH_FAILED,
  '^/csp-report$'
];

export const ROUTES_TO_HIDE_NAV = [
  `^${ROUTE.LOGIN}$`,
  `^${ROUTE.SIGN_UP}$`,
  `^${ROUTE.INVITE}/.*`,
  `^${ROUTE.FORGOT}$`,
  `^${ROUTE.RESET}$`,
  `^${ROUTE.ONBOARDING}$`,
  `^${ROUTE.VERIFY_EMAIL_ERROR}$`
];
