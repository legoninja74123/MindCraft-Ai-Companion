
import assert from 'node:assert/strict';
import { Companion } from './companion.js';

// A minimal bot stub; no live Minecraft connection is needed.
const companion = new Companion({ registry: null });

// Stub Minecraft reads so this test focuses on companion integration.
companion.minecraft.isConnected = () => true;
companion.minecraft.getPosition = () => ({ x: 10, y: 64, z: 20 });
companion.minecraft.getHealth = () => 20;
companion.minecraft.getFood = () => 20;
companion.minecraft.getDimension = () => 'overworld';
companion.minecraft.getGameMode = () => 'survival';
companion.minecraft.getInventory = () => [];

assert.ok(companion.eventManager);
assert.ok(companion.goalManager);
assert.ok(companion.worldModel);

// Create a goal and activate its first subgoal through public methods.
const goal = companion.goalManager.createGoal('Build a shelter');
const subgoal = companion.goalManager.addSubgoal(
    goal.id,
    'Gather wood'
);

assert.equal(
    companion.goalManager.startNextSubgoal(goal.id).id,
    subgoal.id
);

// Read all companion state through its public interface.
const state = companion.getState();

assert.equal(state.connected, true);
assert.deepEqual(state.position, { x: 10, y: 64, z: 20 });

assert.ok(state.worldModel);
assert.ok(state.goals);
assert.equal(state.goals.activeGoal.id, goal.id);
assert.equal(state.goals.activeSubgoal.id, subgoal.id);
assert.equal(state.goals.activeGoal.status, 'active');
assert.equal(state.goals.activeSubgoal.status, 'active');

console.log('All Companion integration tests passed.');