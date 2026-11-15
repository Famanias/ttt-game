import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act, useState } from 'react';
import type { OnlineRoom } from '../lib/online/contracts';

const dom=new Window({url:'http://localhost'});
// Happy DOM's native-animation cancellation differs from browsers. Exercise
// Motion's JS fallback here; real animations/layout run in Playwright.
Object.defineProperty(dom.Element.prototype,'animate',{configurable:true,value:undefined});
for(const [key,value] of Object.entries({window:dom,document:dom.document,navigator:dom.navigator,HTMLElement:dom.HTMLElement,Element:dom.Element,Node:dom.Node,Event:dom.Event,MouseEvent:dom.MouseEvent,SVGElement:dom.SVGElement,getComputedStyle:dom.getComputedStyle.bind(dom),requestAnimationFrame:dom.requestAnimationFrame.bind(dom),cancelAnimationFrame:dom.cancelAnimationFrame.bind(dom),IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
const uid='11111111-1111-4111-8111-111111111111';
function fixture():OnlineRoom{return {
  id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',code:'ABC234',mode:'classic',status:'active',version:5,myMark:'X',serverNow:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),scores:{X:0,O:0,draws:0},
  members:[{userId:uid,slot:'X',ready:true,status:'active',lastSeenAt:new Date().toISOString(),profile:{name:'Alpha',avatarId:'orb-bot'}},{userId:'22222222-2222-4222-8222-222222222222',slot:'O',ready:true,status:'active',lastSeenAt:new Date().toISOString(),profile:{name:'Beta',avatarId:'pixel-blob'}}],
  match:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',version:2,phase:'classic_turn',board:Array(9).fill(null),turn:'X',winner:null,winningLine:null,moveCount:0,streaks:{X:0,O:0},bestStreaks:{X:0,O:0},pendingClaims:0,claimant:null,round:null,startAt:new Date().toISOString(),deadlineAt:null,reconnectDeadline:null,reason:null,rematchVotes:[]}
};}
let canonical=fixture();let hangingLeave=false;let resumeRace=false;let readyStaleOnce=false;let commands:string[]=[];
const channel={on(){return this;},subscribe(callback:(status:string)=>void){queueMicrotask(()=>callback('SUBSCRIBED'));return this;},track:async()=>{},presenceState:()=>({[uid]:[]})};
mock.module('../lib/supabase/browser',()=>({browserSupabase:()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-only'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},realtime:{setAuth:async()=>{}},channel:()=>channel,removeChannel:async()=>{}})}));
// Mock only the external network boundary. Render and interact with the real
// room view, hook, arena, outcome, and local-return state transition.
mock.module('../lib/services/online-game',()=>({ensureGuest:async()=>uid,gameFetch:async()=>({entries:[]}),onlineGame:{snapshot:async()=>({room:canonical}),command:async(roomArg:OnlineRoom,action:string,payload?:Record<string,unknown>)=>{
  commands.push(action);
  if(action==='leave'){if(hangingLeave)return new Promise(()=>{});return Promise.reject(new Error('offline'));}
  if(action==='ready' && typeof payload?.ready==='boolean'){
    if(readyStaleOnce){
      readyStaleOnce=false;
      canonical={...canonical,version:roomArg.version+1};
      throw Object.assign(new Error('The game changed. Synced the latest state; try again.'),{code:'STALE_VERSION'});
    }
    canonical={
      ...canonical,
      version:canonical.version+1,
      members:canonical.members.map(m=>m.slot===canonical.myMark?{...m,ready:Boolean(payload.ready)}:m)
    };
  }
  if(action==='resume'){
    if(resumeRace){canonical={...canonical,version:canonical.version+1,match:{...canonical.match!,phase:'claim',claimant:'O',pendingClaims:1,version:canonical.match!.version+1}};throw new Error('ROUND_CLOSED');}
    canonical={...canonical,version:canonical.version+1,match:{...canonical.match!,version:canonical.match!.version+1,round:{...canonical.match!.round!,id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}}};
  }
  return {room:canonical};
}}}));
const {createRoot}=await import('react-dom/client');
const {OnlineRoomView}=await import('../components/OnlineRoomView');
const {useOnlineRoom}=await import('../hooks/use-online-room');

test('offline and hanging leave still return to local play from arena and results',async()=>{
  for(const finished of [false,true])for(const hang of [false,true]){
    canonical=fixture();hangingLeave=hang;
    if(finished)canonical.match={...canonical.match!,phase:'finished',winner:'X',reason:'board_result'};
    const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
    function App(){const [local,setLocal]=useState(false);return local?<p>Local games available</p>:<OnlineRoomView initialRoom={canonical} muted onToggleMute={()=>{}} onExit={()=>setLocal(true)}/>;}
    try{
      await act(async()=>{root.render(<App/>);await new Promise(resolve=>setTimeout(resolve,30));});
      const button=finished?Array.from(container.querySelector('[role="dialog"]')!.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Lobby'):container.querySelector('button[aria-label="Exit to lobby"]');assert(button);
      await act(async()=>{(button as HTMLButtonElement).click();await new Promise(resolve=>setTimeout(resolve,10));});
      assert.match(container.textContent??'',/Local games available/);
    }finally{await act(async()=>root.unmount());container.remove();}
  }
});

test('room boot requests canonical restart for an unsubmitted round and preserves submitted rounds',async()=>{
  for(const submitted of [false,true]){
    canonical=fixture();canonical.mode='clash';canonical.match!.phase='round';canonical.match!.round={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',index:1,type:'perfect-timing',seed:5,startAt:new Date().toISOString(),endAt:new Date(Date.now()+10000).toISOString(),submitBy:new Date(Date.now()+12000).toISOString(),status:'playing',suddenDeath:false,config:{durationMs:10000,presses:3,targetCenter:90,speed:244},submitted:{X:submitted,O:false},scores:null};
    const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
    const initial=canonical;
    function Observe(){const {room}=useOnlineRoom(initial);return <output>{room.match!.round!.id}</output>;}
    try{
      await act(async()=>{root.render(<Observe/>);await new Promise(resolve=>setTimeout(resolve,40));});
      assert.equal(container.textContent,submitted?'cccccccc-cccc-4ccc-8ccc-cccccccccccc':'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    }finally{await act(async()=>root.unmount());container.remove();}
  }
});

test('a submission resolving during reload reconciles and still establishes live updates',async()=>{
  canonical=fixture();canonical.mode='clash';canonical.match!.phase='round';canonical.match!.round={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',index:1,type:'perfect-timing',seed:5,startAt:new Date().toISOString(),endAt:new Date(Date.now()+10000).toISOString(),submitBy:new Date(Date.now()+12000).toISOString(),status:'playing',suddenDeath:false,config:{durationMs:10000,presses:3,targetCenter:90,speed:244},submitted:{X:false,O:true},scores:null};resumeRace=true;
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  const initial=canonical;
  function Observe(){const {room,connected}=useOnlineRoom(initial);return <output>{room.match!.phase}:{connected?'live':'poll'}</output>;}
  try{await act(async()=>{root.render(<Observe/>);await new Promise(resolve=>setTimeout(resolve,40));});assert.equal(container.textContent,'claim:live');}
  finally{resumeRace=false;await act(async()=>root.unmount());container.remove();}
});

test('room boot sends an immediate heartbeat without waiting for the 5s interval',async()=>{
  canonical=fixture();commands=[];
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  const initial=canonical;
  function Observe(){useOnlineRoom(initial);return <output>ok</output>;}
  try{
    await act(async()=>{root.render(<Observe/>);await new Promise(resolve=>setTimeout(resolve,40));});
    assert.ok(commands.includes('heartbeat'),`expected boot heartbeat, got ${JSON.stringify(commands)}`);
  }finally{await act(async()=>root.unmount());container.remove();}
});

test('waiting room ready button clearly reflects ready state and shows empty opponent slot cleanly',async()=>{
  canonical={
    ...fixture(),
    status:'waiting',
    version:1,
    members:[{userId:uid,slot:'X',ready:false,status:'active',lastSeenAt:new Date().toISOString(),profile:{name:'Alpha',avatarId:'orb-bot'}}],
    match:null,
  };
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  try{
    await act(async()=>{root.render(<OnlineRoomView initialRoom={canonical} muted onToggleMute={()=>{}} onExit={()=>{}}/>);await new Promise(resolve=>setTimeout(resolve,40));});
    const text=container.textContent??'';
    assert.doesNotMatch(text,/\? (online|Ready|Not ready)/);
    assert.match(text,/Opponent \(O\).*Waiting to join/i);

    const readyBtn=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Ready Up');
    assert.ok(readyBtn,'Expected Ready Up button when user is not ready');
    assert.equal(readyBtn.getAttribute('aria-pressed'),'false');

    await act(async()=>{readyBtn.click();await new Promise(resolve=>setTimeout(resolve,40));});
    assert.equal(readyBtn.getAttribute('aria-pressed'),'true');
    assert.notEqual(readyBtn.textContent?.trim(),'Not Ready');
    assert.match(readyBtn.textContent??'',/Ready/i);
    assert.doesNotMatch(container.textContent??'',/\? (online|Ready|Not ready)/);

    await act(async()=>{readyBtn.click();await new Promise(resolve=>setTimeout(resolve,40));});
    assert.equal(readyBtn.getAttribute('aria-pressed'),'false');
    assert.equal(readyBtn.textContent?.trim(),'Ready Up');
    const statusText=container.querySelector('[role="status"]')?.textContent??'';
    assert.doesNotMatch(statusText,/Alpha \(X\).*\bReady\b/);
  }finally{await act(async()=>root.unmount());container.remove();}
});

test('ready command automatically syncs and retries once on concurrent STALE_VERSION',async()=>{
  canonical={
    ...fixture(),
    status:'waiting',
    version:2,
    members:[
      {userId:uid,slot:'X',ready:false,status:'active',lastSeenAt:new Date().toISOString(),profile:{name:'Alpha',avatarId:'orb-bot'}},
      {userId:'22222222-2222-4222-8222-222222222222',slot:'O',ready:false,status:'active',lastSeenAt:new Date().toISOString(),profile:{name:'Beta',avatarId:'pixel-blob'}},
    ],
    match:null,
  };
  readyStaleOnce=true;commands=[];
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  try{
    await act(async()=>{root.render(<OnlineRoomView initialRoom={canonical} muted onToggleMute={()=>{}} onExit={()=>{}}/>);await new Promise(resolve=>setTimeout(resolve,40));});
    const readyBtn=Array.from(container.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Ready Up');
    assert.ok(readyBtn);
    await act(async()=>{readyBtn.click();await new Promise(resolve=>setTimeout(resolve,50));});
    assert.equal(readyBtn.getAttribute('aria-pressed'),'true');
    assert.equal(container.querySelector('[role="alert"]')?.textContent??'','');
    assert.equal(commands.filter(c=>c==='ready').length,2);
  }finally{readyStaleOnce=false;await act(async()=>root.unmount());container.remove();}
});
