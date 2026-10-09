
import assert from 'node:assert/strict';
import { Companion } from './companion.js';

function createTestCompanion() {
    const companion = new Companion({ registry: null });

    // Stub Minecraft reads so no live connection is needed.
    companion.minecraft.isConnected = () => true;
    companion.minecraft.getPosition = () => ({
        x: 10,
        y: 64,
        z: 20
    });
    companion.minecraft.getHealth = () => 20;
    companion.minecraft.getFood = () => 20;
    companion.minecraft.getDimension = () => 'overworld';
    companion.minecraft.getGameMode = () => 'survival';
    companion.minecraft.getInventory = () => [];

    companion.minecraft.getNearbyBlocks = () => [];
    companion.minecraft.getNearbyEntities = () => [];

    return companion;
}

// Test 1: Companion exposes its managers and current state.
{
    const companion = createTestCompanion();

    assert.ok(companion.eventManager);
    assert.ok(companion.attentionManager);
    assert.ok(companion.goalManager);
    assert.ok(companion.worldModel);

    const goal = companion.goalManager.createGoal('Build a shelter');
    const subgoal = companion.goalManager.addSubgoal(
        goal.id,
        'Gather wood'
    );

    assert.equal(
        companion.goalManager.startNextSubgoal(goal.id).id,
        subgoal.id
    );

    const state = companion.getState();

    assert.equal(state.connected, true);
    assert.deepEqual(state.position, { x: 10, y: 64, z: 20 });

    assert.ok(state.worldModel);
    assert.ok(state.goals);
    assert.ok(Object.hasOwn(state, 'attention'));
    assert.ok(Array.isArray(state.pendingAttentionEvents));

    assert.equal(state.goals.activeGoal.id, goal.id);
    assert.equal(state.goals.activeSubgoal.id, subgoal.id);
    assert.equal(state.goals.activeGoal.status, 'active');
    assert.equal(state.goals.activeSubgoal.status, 'active');
}

// Test 2: An active subgoal becomes the attention focus
// when there are no higher-priority events.
{
    const companion = createTestCompanion();

    const goal = companion.goalManager.createGoal('Build a shelter');
    const subgoal = companion.goalManager.addSubgoal(
        goal.id,
        'Gather wood'
    );

    companion.goalManager.startNextSubgoal(goal.id);

    const observation = companion.observeNearby();

    assert.equal(observation.attention.type, 'SUBGOAL');
    assert.equal(observation.attention.data.id, subgoal.id);
    assert.equal(companion.getState().attention.type, 'SUBGOAL');
}

// Test 3: An immediate hostile threat takes priority
// over an active subgoal.
{
    const companion = createTestCompanion();

    const goal = companion.goalManager.createGoal('Build a shelter');
    companion.goalManager.addSubgoal(goal.id, 'Gather wood');
    companion.goalManager.startNextSubgoal(goal.id);

    // Keep this integration test independent of entity metadata.
    // WorldModel classification is tested separately.
    companion.worldModel.getEntityMemoryPolicy = () => 'hostile';

    companion.minecraft.getNearbyEntities = () => [
        {
            id: 'test-zombie',
            name: 'zombie',
            type: 'zombie',
            position: { x: 12, y: 64, z: 20 }
        }
    ];

    const observation = companion.observeNearby();

    assert.ok(
        observation.events.some(
            event =>
                event.type === 'HOSTILE_DETECTED' &&
                event.data.withinThreatRange === true
        )
    );

    assert.equal(observation.attention.type, 'WORLD_EVENT');
    assert.equal(
        observation.attention.data.type,
        'HOSTILE_DETECTED'
    );

    // The goal remains active; attention has not cancelled it.
    assert.equal(
        companion.goalManager.getActiveGoal().status,
        'active'
    );
}


 // Test 4: The Companion can acknowledge a pending attention event.
{
    const companion = createTestCompanion();

    const event = {
        id: 'test-block-change',
        type: 'BLOCK_CHANGED',
        priority: 'normal',
        timestamp: Date.now(),
        data: {
            position: { x: 11, y: 64, z: 20 }
        }
    };

    companion.attentionManager.selectFocus({
        events: [event]
    });

    assert.ok(
        companion.getState().pendingAttentionEvents.some(
            pending => pending.id === event.id
        ),
        'Event should be pending before acknowledgment'
    );

    assert.equal(
        companion.acknowledgeAttentionEvent(event.id),
        true,
        'Acknowledgment should succeed for a pending event'
    );

    assert.equal(
        companion.getState().pendingAttentionEvents.some(
            pending => pending.id === event.id
        ),
        false,
        'Acknowledged event should no longer be pending'
    );

    assert.equal(
        companion.acknowledgeAttentionEvent(event.id),
        false,
        'Acknowledging the same event again should return false'
    );
}

console.log('All Companion integration tests passed.');