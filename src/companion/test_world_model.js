
import assert from 'node:assert/strict';
import { WorldModel } from './world_model.js';

const model = new WorldModel();
const position = { x: 10, y: 64, z: -5 };

console.log('\nTest 1: New block');
    const first = model.observeBlock({
        type: 'stone',
        position
});

assert.equal(first.status, 'NEW');
assert.equal(first.block.validity, 'valid');
console.log('PASS: New block is valid');

console.log('\nTest 2: Re-observe same block');
const second = model.observeBlock({
    type: 'stone',
    position
});

assert.equal(second.status, 'UNCHANGED');
assert.equal(second.block.validity, 'valid');
assert.equal(second.block.confidence, 1.0);
assert.equal(second.block.source, 'direct');
console.log('PASS: Re-observation preserves validity');

console.log('\nTest 3: Invalidate block');
assert.equal(model.forgetCurrentObservation(position), true);

const invalidated = model.getBlock(position);
assert.equal(invalidated.validity, 'invalidated');
assert.equal(invalidated.confidence, 0);
assert.equal(invalidated.source, 'invalidated');
assert.equal(model.getBlockFreshness(position), 'INVALIDATED');
assert.equal(model.getCurrentBlock(position), null);
assert.equal(
    model.getBlockHistory(position).validity,
    'invalidated'
);
console.log('PASS: Invalidation works');

console.log('\nTest 4: Observe block again');
const restored = model.observeBlock({
    type: 'stone',
    position
});


assert.equal(restored.status, 'UNCHANGED');
assert.equal(restored.block.validity, 'valid');
assert.equal(restored.block.confidence, 1.0);
assert.equal(restored.block.source, 'direct');
assert.equal(model.getCurrentBlock(position).type, 'stone');
console.log('PASS: Direct observation restores validity');

console.log('\nTest 5: Freshness');
assert.equal(model.getBlockFreshness(position), 'FRESH');

// Simulate an observation that is older than 30 seconds.
const block = model.getBlock(position);
block.lastSeen = Date.now() - 31000;

assert.equal(model.getBlockFreshness(position), 'STALE');

// Stale does not mean invalid or forgotten.
assert.equal(model.getCurrentBlock(position).type, 'stone');
assert.equal(model.getBlock(position).type, 'stone');

console.log('PASS: Stale blocks remain available as beliefs');
console.log('PASS: Freshness classification works');

console.log('\nTest 6: Block history');
model.observeBlock({
    type: 'dirt',
    position
});

const history = model.getPreviousTypes(position);

assert.equal(model.getBlock(position).type, 'dirt');
assert.ok(history.includes('stone'));
assert.equal(
    model.getBlockHistory(position).validity,
    'valid'
);
console.log('PASS: Previous block type is preserved');

console.log('\nTest 7: Entity memory');

const entityModel = new WorldModel({
    entitiesByName: {
        zombie: {
            name: 'zombie',
            type: 'hostile',
            category: 'Hostile mobs'
        }
    }
});

const firstObservation = entityModel.observeEntity({
    id: 42,
    name: 'Zombie',
    type: 'zombie',
    position: { x: 12, y: 64, z: -5 }
});

assert.equal(firstObservation.status, 'NEW');
assert.equal(firstObservation.entity.firstSeen != null, true);
assert.deepEqual(
    firstObservation.entity.previousPositions,
    []
);
console.log('PASS: New entity is recorded');

// Observe the same entity at a different position.
const secondObservation = entityModel.observeEntity({
    id: 42,
    name: 'Zombie',
    type: 'zombie',
    position: { x: 13, y: 64, z: -5 }
});

assert.equal(secondObservation.status, 'UPDATED');
assert.deepEqual(
    secondObservation.entity.position,
    { x: 13, y: 64, z: -5 }
);
assert.equal(
    secondObservation.entity.previousPositions.length,
    1
);
assert.deepEqual(
    secondObservation.entity.previousPositions[0].position,
    { x: 12, y: 64, z: -5 }
);
console.log('PASS: Entity movement preserves previous position');

// Observe the entity again without moving it.
entityModel.observeEntity({
    id: 42,
    name: 'Zombie',
    type: 'zombie',
    position: { x: 13, y: 64, z: -5 }
});

assert.equal(
    entityModel.getEntity(42).previousPositions.length,
    1
);
console.log('PASS: Stationary observations do not add movement history');

// Verify entity retrieval.
assert.equal(entityModel.getEntities().length, 1);
assert.equal(entityModel.getEntity(42).name, 'Zombie');
console.log('PASS: Entity retrieval works');

console.log('\nTest 8: Entity memory policies');

const policyModel = new WorldModel({
    entitiesByName: {
        zombie: {
            name: 'zombie',
            type: 'hostile',
            category: 'Hostile mobs'
        },
        sheep: {
            name: 'sheep',
            type: 'animal',
            category: 'Passive mobs'
        },
        enderman: {
            name: 'enderman',
            type: 'mob',
            category: 'Neutral mobs'
        }
    }
});

// Hostile entities should retain movement history.
const zombieFirst = policyModel.observeEntity({
    id: 101,
    name: 'zombie',
    type: 'mob',
    position: { x: 10, y: 64, z: 10 }
});

assert.equal(zombieFirst.entity.memoryPolicy, 'hostile');

policyModel.observeEntity({
    id: 101,
    name: 'zombie',
    type: 'mob',
    position: { x: 11, y: 64, z: 10 }
});

assert.equal(
    policyModel.getEntity(101).previousPositions.length,
    1
);
console.log('PASS: Hostile history is retained');

// Resource entities should not accumulate movement history.
const sheepFirst = policyModel.observeEntity({
    id: 102,
    name: 'sheep',
    type: 'mob',
    position: { x: 20, y: 64, z: 20 }
});

assert.equal(sheepFirst.entity.memoryPolicy, 'peaceful');

policyModel.observeEntity({
    id: 102,
    name: 'sheep',
    type: 'mob',
    position: { x: 21, y: 64, z: 20 }
});

assert.deepEqual(
    policyModel.getEntity(102).position,
    { x: 21, y: 64, z: 20 }
);
assert.equal(
    policyModel.getEntity(102).previousPositions.length,
    0
);
console.log('PASS: Resource entities skip movement history');

const enderman = policyModel.observeEntity({
    id: 104,
    name: 'enderman',
    type: 'mob',
    position: { x: 40, y: 64, z: 40 }
});

assert.equal(enderman.entity.memoryPolicy, 'retaliatory');
console.log('PASS: Neutral entities receive retaliatory policy');

// Unknown entities should use the conservative default.
const unknown = policyModel.observeEntity({
    id: 103,
    name: 'unfamiliar_mod_creature',
    type: 'mob',
    position: { x: 30, y: 64, z: 30 }
});

const zombie = policyModel.getEntity(101);

// Simulate a zombie last seen more than two minutes ago.
zombie.lastSeen = Date.now() - 121000;

assert.equal(
    policyModel.getEntityMemoryStatus(101),
    'PRESUMED_DESPAWNED'
);

assert.ok(policyModel.getEntity(101));
console.log('PASS: Old hostile sightings expire without deleting history');

assert.equal(unknown.entity.memoryPolicy, 'unknown');
console.log('PASS: Unknown entities default to unknown');

console.log('PASS: Entity memory policies work');

console.log('\nAll WorldModel tests passed.');