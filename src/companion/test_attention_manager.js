
import assert from 'node:assert/strict';
import { AttentionManager } from './attention_manager.js';

const manager = new AttentionManager({
    eventLifetimeMs: 10000
});

const playerInstruction = { text: 'Follow me' };
const activeSubgoal = { id: 'subgoal-1', description: 'Gather wood' };
const activeGoal = { id: 'goal-1', description: 'Build a house' };

// Test 1: No work means idle.
assert.equal(manager.selectFocus({}, 1000).type, 'IDLE');

// Test 2: A proposal is lower priority than an active goal.
assert.equal(
    manager.selectFocus({
        activeGoal,
        proposal: { description: 'Explore a cave' }
    }, 1000).type,
    'GOAL'
);

// Test 3: A subgoal takes focus over its parent goal.
assert.equal(
    manager.selectFocus({ activeGoal, activeSubgoal }, 1000).type,
    'SUBGOAL'
);

// Test 4: A player instruction takes focus over ordinary goals.
assert.equal(
    manager.selectFocus({
        playerInstruction,
        activeGoal,
        activeSubgoal
    }, 1000).type,
    'PLAYER_INSTRUCTION'
);

// Test 5: A safety condition takes precedence over a player instruction.
assert.equal(
    manager.selectFocus({
        safety: { active: true, reason: 'Critical danger' },
        playerInstruction
    }, 1000).type,
    'SAFETY'
);

// Test 6: A hostile inside threat range takes focus over a player instruction.
const threat = {
    id: 1,
    type: 'HOSTILE_DETECTED',
    priority: 'high',
    timestamp: 1000,
    data: { withinThreatRange: true, entityId: 42 }
};

const threatFocus = manager.selectFocus({
    events: [threat],
    playerInstruction
}, 1000);

assert.equal(threatFocus.type, 'WORLD_EVENT');
assert.equal(threatFocus.data.type, 'HOSTILE_DETECTED');

// Test 7: A distant hostile does not override the player instruction.
manager.clear();

const distantHostile = {
    id: 2,
    type: 'HOSTILE_DETECTED',
    priority: 'normal',
    timestamp: 1000,
    data: { withinThreatRange: false, entityId: 43 }
};

assert.equal(
    manager.selectFocus({
        events: [distantHostile],
        playerInstruction
    }, 1000).type,
    'PLAYER_INSTRUCTION'
);

// Test 8: Events remain pending even if a later observation has no events.
manager.clear();

manager.selectFocus({
    events: [{
        id: 3,
        type: 'BLOCK_CHANGED',
        priority: 'normal',
        timestamp: 1000,
        data: { currentType: 'diamond_ore' }
    }]
}, 1000);

const retainedFocus = manager.selectFocus({}, 2000);

assert.equal(retainedFocus.type, 'WORLD_EVENT');
assert.equal(retainedFocus.data.id, 3);

// Test 9: Acknowledged events are removed.
assert.equal(manager.acknowledgeEvent(3), true);
assert.equal(manager.selectFocus({}, 3000).type, 'IDLE');

// Test 10: Expired events are removed.
manager.selectFocus({
    events: [{
        id: 4,
        type: 'BLOCK_CHANGED',
        priority: 'normal',
        timestamp: 1000,
        data: {}
    }]
}, 1000);

assert.equal(manager.selectFocus({}, 12000).type, 'IDLE');
assert.equal(manager.getPendingEvents().length, 0);

console.log('All 10 AttentionManager tests passed.');