import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTargetEvent } from '../lib/online/input';

const config={durationMs:5500,targets:[{id:0,x:50,y:50,spawn:0,end:550,points:90},{id:1,x:20,y:20,spawn:550,end:1100,points:140}]};
test('a displayed target whose expiry fell between render ticks cannot poison a valid trace',()=>{
  const prior=[{t:200,targetId:0,x:50,y:50}];
  assert.equal(captureTargetEvent(config,0,551,{x:50,y:50},new Set(),200),null);
  assert.equal(captureTargetEvent(config,1,549,{x:20,y:20},new Set(),200),null);
  assert.deepEqual(prior,[{t:200,targetId:0,x:50,y:50}]);
});
test('capture accepts mobile edge taps and rejects duplicates, impossible points and event bursts',()=>{
  assert.deepEqual(captureTargetEvent(config,0,500,{x:50,y:59.375},new Set(),0),{t:500,targetId:0,x:50,y:59.375});
  assert.equal(captureTargetEvent(config,0,500,{x:50,y:50},new Set([0]),0),null);
  assert.equal(captureTargetEvent(config,0,500,{x:90,y:90},new Set(),0),null);
  assert.equal(captureTargetEvent(config,0,500,{x:50,y:50},new Set(),480),null);
});
