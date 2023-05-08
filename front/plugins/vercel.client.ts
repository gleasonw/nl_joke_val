import { inject } from '@vercel/analytics';
 
export default () => {
  console.log("inject analytics")
  inject();
};