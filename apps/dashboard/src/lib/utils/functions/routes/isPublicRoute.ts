import { PUBLIC_ROUTES } from '$lib/utils/constants/routes';

export const isPublicRoute = (route = '') => {
  return PUBLIC_ROUTES.some((publicRoute) => {
    const regex = new RegExp(publicRoute, 'g');
    return regex.test(route);
  });
};

export default isPublicRoute;
