import type { OnlineRound, Trace } from './contracts';

// The same 12%-normalized hit envelope is enforced by SQL. It covers a 26px
// normal target in the supported mobile field without rejecting edge taps.
export function captureTargetEvent(config:OnlineRound['config'],id:number,t:number,point:{x:number;y:number},used:ReadonlySet<number>,lastT:number):Trace['events'][number]|null {
  const target=config.targets?.find(item=>item.id===id);
  if(!target||used.has(id)||!Number.isInteger(t)||t<target.spawn||t>=target.end||t>config.durationMs||t-lastT<40)return null;
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>100||point.y<0||point.y>100)return null;
  if((point.x-target.x)**2+(point.y-target.y)**2>144)return null;
  return {t,targetId:id,x:point.x,y:point.y};
}
