
import assert from 'node:assert/strict';
import { EventManager } from './event_manager.js';

const manager = new EventManager({ threatRange: 6 });
const selfPosition = { x: 0, y: 64, z: 0 };

function hostileResult(status, id, x) {
    return {
        status,
        entity: {
            id,
            name: 'zombie',
            type: 'zombie',
            memoryPolicy: 'hostile',
            position: { x, y: 64, z: 0 }
        }
    };
}

// Test 1: Detect a hostile for the first time.
let events = manager.process({
    blocks: [],
    entities: [hostileResult('NEW', 101, 10)]
}, selfPosition);

assert.equal(events.length, 1);
assert.equal(events[0].type, 'HOSTILE_DETECTED');
assert.equal(events[0].data.withinThreatRange, false);

// Test 2: Emit a threat event when it enters range.
events = manager.process({
    blocks: [],
    entities: [hostileResult('UPDATED', 101, 5)]
}, selfPosition);

assert.equal(events.length, 1);
assert.equal(events[0].type, 'THREAT_APPROACHING');

// Test 3: Do not repeat the event while it stays in range.
events = manager.process({
    blocks: [],
    entities: [hostileResult('UPDATED', 101, 4)]
}, selfPosition);

assert.equal(events.length, 0);

// Test 4: Emit another threat event if it leaves and re-enters range.
manager.process({
    blocks: [],
    entities: [hostileResult('UPDATED', 101, 10)]
}, selfPosition);

events = manager.process({
    blocks: [],
    entities: [hostileResult('UPDATED', 101, 5)]
}, selfPosition);

assert.equal(events.length, 1);
assert.equal(events[0].type, 'THREAT_APPROACHING');

// Test 5: Detect a block change.
events = manager.process({
    blocks: [{
        status: 'CHANGED',
        previousType: 'stone',
        block: {
            type: 'diamond_ore',
            position: { x: 2, y: 63, z: 3 }
        }
    }],
    entities: []
}, selfPosition);

assert.equal(events.length, 1);
assert.equal(events[0].type, 'BLOCK_CHANGED');
assert.equal(events[0].data.previousType, 'stone');
assert.equal(events[0].data.currentType, 'diamond_ore');

// Test 6: Ignore non-hostile entities.
events = manager.process({
    blocks: [],
    entities: [{
        status: 'NEW',
        entity: {
            id: 202,
            name: 'sheep',
            memoryPolicy: 'peaceful',
            position: { x: 1, y: 64, z: 0 }
        }
    }]
}, selfPosition);

assert.equal(events.length, 0);

console.log('All 6 EventManager tests passed.');