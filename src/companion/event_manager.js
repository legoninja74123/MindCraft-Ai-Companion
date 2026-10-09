
/**
 * EventManager
 *
 * Converts WorldModel observation results into meaningful world events.
 *
 * This module detects events only. It does not decide whether to interrupt
 * a task or change the Companion's goals.
 */
export class EventManager {
    constructor(options = {}) {
        this.threatRange = options.threatRange ?? 6;

        // Tracks whether each hostile was inside the threat range
        // during its previous observation.
        this.hostileInRange = new Map();

        this.nextEventId = 1;
    }

    createEvent(type, priority, data) {
        return {
            id: this.nextEventId++,
            type,
            priority,
            timestamp: Date.now(),
            data
        };
    }

    getDistance(a, b) {
        if (!a || !b) {
            return null;
        }

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    process(observation, selfPosition) {
        const events = [];

        // Detect changes to previously observed blocks.
        for (const result of observation?.blocks ?? []) {
            if (result.status !== 'CHANGED') {
                continue;
            }

            events.push(this.createEvent(
                'BLOCK_CHANGED',
                'normal',
                {
                    position: result.block.position,
                    previousType: result.previousType,
                    currentType: result.block.type
                }
            ));
        }

        // Detect hostile entities and threat-range transitions.
        for (const result of observation?.entities ?? []) {
            const entity = result.entity;

            if (!entity || entity.id == null) {
                continue;
            }

            if (entity.memoryPolicy !== 'hostile') {
                continue;
            }

            const distance = this.getDistance(
                selfPosition,
                entity.position
            );

            const inRange =
                distance !== null &&
                distance <= this.threatRange;

            if (result.status === 'NEW') {
                events.push(this.createEvent(
                    'HOSTILE_DETECTED',
                    inRange ? 'high' : 'normal',
                    {
                        entityId: entity.id,
                        entityType: entity.name ?? entity.type ?? 'unknown',
                        position: entity.position,
                        distance,
                        withinThreatRange: inRange
                    }
                ));
            }

            const wasInRange =
                this.hostileInRange.get(entity.id);

            if (wasInRange === false && inRange) {
                events.push(this.createEvent(
                    'THREAT_APPROACHING',
                    'high',
                    {
                        entityId: entity.id,
                        entityType: entity.name ?? entity.type ?? 'unknown',
                        position: entity.position,
                        distance
                    }
                ));
            }

            if (distance !== null) {
                this.hostileInRange.set(entity.id, inRange);
            }
        }

        return events;
    }

    clear() {
        this.hostileInRange.clear();
        this.nextEventId = 1;
    }
}