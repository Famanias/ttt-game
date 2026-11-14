import { api } from '@/lib/server/api';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>api(request,'create');
