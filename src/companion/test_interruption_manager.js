import assert from 'node:assert/strict';
import { InterruptionManager } from './interruption_manager.js';

function createEvent(type, data = {}, id = 1) {
    return {
        id,
        type,
        priority: 'high',
        timestamp: Date.now(),
        data
    };
}

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`PASS: ${name}`);
    } catch (error) {
        console.error(`FAIL: ${name}`);
        throw error;
    }
}

runTest('starts with no active interruption', () => {
    const manager = new InterruptionManager();

    assert.equal(manager.getState().activeInterruption, null);
    assert.equal(manager.getState().history.length, 0);
});

runTest('ignores hostile detection outside threat range', () => {
    const manager = new InterruptionManager();
    const event = createEvent('HOSTILE_DETECTED', {
        withinThreatRange: false
    });

    assert.equal(manager.beginInterruption(event), null);
    assert.equal(manager.getState().activeInterruption, null);
});

runTest('starts interruption for hostile inside threat range', () => {
    const manager = new InterruptionManager();
    const goal = {
        id: 10,
        description: 'Build a shelter',
        status: 'active'
    };
    const subgoal = {
        id: 11,
        description: 'Collect wood',
        status: 'active'
    };

    const interruption = manager.beginInterruption(
        createEvent('HOSTILE_DETECTED', {
            withinThreatRange: true
        }),
        goal,
        subgoal
    );

    assert.ok(interruption);
    assert.equal(interruption.reason, 'HOSTILE_DETECTED');
    assert.equal(interruption.interruptedGoal.id, 10);
    assert.equal(interruption.interruptedSubgoal.id, 11);
    assert.equal(interruption.status, 'active');
});

runTest('starts interruption for approaching threat', () => {
    const manager = new InterruptionManager();

    const interruption = manager.beginInterruption(
        createEvent('THREAT_APPROACHING', {
            withinThreatRange: true
        })
    );

    assert.ok(interruption);
    assert.equal(interruption.reason, 'THREAT_APPROACHING');
});

runTest('does not overwrite an active interruption', () => {
    const manager = new InterruptionManager();

    const first = manager.beginInterruption(
        createEvent('HOSTILE_DETECTED', {
            withinThreatRange: true
        }, 1)
    );

    const second = manager.beginInterruption(
        createEvent('THREAT_APPROACHING', {
            withinThreatRange: true
        }, 2)
    );

    assert.equal(second.id, first.id);
    assert.equal(second.eventId, 1);
    assert.equal(manager.getState().history.length, 1);
});

runTest('returns false when resolving without an active interruption', () => {
    const manager = new InterruptionManager();

    assert.equal(manager.resolveInterruption(), false);
});

runTest('resolves interruption and records resolution in history', () => {
    const manager = new InterruptionManager();

    const interruption = manager.beginInterruption(
        createEvent('HOSTILE_DETECTED', {
            withinThreatRange: true
        })
    );

    assert.equal(manager.resolveInterruption('threat_cleared'), true);
    assert.equal(manager.getState().activeInterruption, null);
    assert.equal(manager.getState().history.length, 1);
    assert.equal(interruption.status, 'resolved');
    assert.equal(interruption.resolutionReason, 'threat_cleared');
    assert.ok(interruption.resolvedAt);
});

runTest('allows a new interruption after resolution', () => {
    const manager = new InterruptionManager();

    manager.beginInterruption(
        createEvent('HOSTILE_DETECTED', {
            withinThreatRange: true
        }, 1)
    );

    manager.resolveInterruption();

    const next = manager.beginInterruption(
        createEvent('THREAT_APPROACHING', {
            withinThreatRange: true
        }, 2)
    );

    assert.ok(next);
    assert.equal(next.eventId, 2);
    assert.equal(next.id, 2);
    assert.equal(manager.getState().history.length, 2);
});

runTest('clear resets all manager state', () => {
    const manager = new InterruptionManager();

    manager.beginInterruption(
        createEvent('HOSTILE_DETECTED', {
            withinThreatRange: true
        })
    );

    manager.clear();

    assert.equal(manager.getState().activeInterruption, null);
    assert.equal(manager.getState().history.length, 0);

    const next = manager.beginInterruption(
        createEvent('THREAT_APPROACHING', {
            withinThreatRange: true
        })
    );

    assert.equal(next.id, 1);
});

console.log('\nAll InterruptionManager tests passed.');