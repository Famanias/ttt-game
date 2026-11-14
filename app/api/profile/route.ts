import { api } from '@/lib/server/api';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>api(request,'profile_get');
export const PUT=(request:Request)=>api(request,'profile');
