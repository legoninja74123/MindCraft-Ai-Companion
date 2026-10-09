
import assert from 'node:assert/strict';
import { GoalManager } from './goal_manager.js';

const manager = new GoalManager();

// Test 1: The first goal becomes active.
const goal = manager.createGoal('Build a house');

assert.equal(goal.status, 'active');
assert.equal(manager.getActiveGoal().id, goal.id);

// Test 2: A second goal queues instead of replacing the active goal.
const queuedGoal = manager.createGoal('Explore a cave');

assert.equal(queuedGoal.status, 'queued');
assert.equal(manager.getActiveGoal().id, goal.id);

// Test 3: Proposals do not become persistent goals automatically.
const proposal = manager.proposeGoal(
    'Build a farm',
    { reason: 'Food could become useful later.' }
);

assert.equal(proposal.status, 'pending');
assert.equal(manager.goals.size, 2);

// Test 4: Rejecting a proposal does not create a goal.
assert.equal(manager.rejectProposal(proposal.id), true);
assert.equal(manager.getProposal(proposal.id).status, 'rejected');
assert.equal(manager.goals.size, 2);

// Test 5: Approving a proposal creates a goal.
const approvedProposal = manager.proposeGoal('Build a bridge');
const approvedGoal = manager.approveProposal(approvedProposal.id);

assert.equal(manager.getProposal(approvedProposal.id).status, 'approved');
assert.equal(approvedGoal.description, 'Build a bridge');
assert.equal(approvedGoal.status, 'queued');

// Test 6: Only one subgoal is active at a time.
const first = manager.addSubgoal(goal.id, 'Gather wood');
const second = manager.addSubgoal(goal.id, 'Craft planks');

assert.equal(manager.startNextSubgoal(goal.id).id, first.id);
assert.equal(manager.startNextSubgoal(goal.id).id, first.id);
assert.equal(second.status, 'pending');

// Test 7: Completing a subgoal permits the next one to start.
assert.equal(manager.completeSubgoal(goal.id, first.id), true);
assert.equal(manager.startNextSubgoal(goal.id).id, second.id);

// Test 8: A goal cannot complete with unfinished subgoals.
assert.equal(manager.completeGoal(goal.id), false);


 // Test 9: Failed subgoals can be explicitly retried.
assert.equal(
    manager.failSubgoal(goal.id, second.id, 'Could not find enough wood'),
    true
);
assert.equal(second.status, 'failed');
assert.equal(second.failureReason, 'Could not find enough wood');
assert.equal(manager.completeGoal(goal.id), false);

assert.equal(manager.retrySubgoal(goal.id, second.id), true);
assert.equal(second.status, 'pending');
assert.equal(second.failureReason, undefined);
assert.equal(second.failedAt, undefined);

// A pending subgoal cannot be retried again.
assert.equal(manager.retrySubgoal(goal.id, second.id), false);

// Test 10: The retried subgoal uses the normal lifecycle.
assert.equal(manager.startNextSubgoal(goal.id).id, second.id);
assert.equal(second.status, 'active');
assert.equal(manager.completeSubgoal(goal.id, second.id), true);
assert.equal(second.status, 'completed');

// Test 11: Pausing and resuming preserve the active goal.
assert.equal(manager.pauseGoal(goal.id), true);
assert.equal(manager.getActiveGoal(), null);
assert.equal(manager.getGoal(goal.id).status, 'paused');

assert.equal(manager.resumeGoal(goal.id), true);
assert.equal(manager.getActiveGoal().id, goal.id);

// Test 12: Completing a goal activates the next queued goal.
assert.equal(manager.completeGoal(goal.id), true);
assert.equal(manager.getGoal(goal.id).status, 'completed');
assert.equal(manager.getActiveGoal().id, queuedGoal.id);
assert.equal(queuedGoal.status, 'active');

// Test 13: Invalid transitions are rejected.
assert.equal(manager.completeSubgoal(goal.id, first.id), false);
assert.equal(manager.resumeGoal(queuedGoal.id), false);

// A subgoal from a paused, non-active goal cannot be retried.
const retryManager = new GoalManager();
const retryGoal = retryManager.createGoal('Gather supplies');
const retrySubgoal = retryManager.addSubgoal(
    retryGoal.id,
    'Collect wood'
);

assert.equal(
    retryManager.startNextSubgoal(retryGoal.id).id,
    retrySubgoal.id
);
assert.equal(
    retryManager.failSubgoal(
        retryGoal.id,
        retrySubgoal.id,
        'Not enough tools'
    ),
    true
);
assert.equal(retryManager.pauseGoal(retryGoal.id), true);
assert.equal(
    retryManager.retrySubgoal(retryGoal.id, retrySubgoal.id),
    false
);
assert.equal(retrySubgoal.status, 'failed');

// Test 14: State exposes the active goal and subgoal.
const state = manager.getState();

assert.equal(state.activeGoal.id, queuedGoal.id);
assert.equal(state.activeSubgoal, null);
assert.ok(Array.isArray(state.goals));
assert.ok(Array.isArray(state.proposals));

console.log('All GoalManager tests passed.');