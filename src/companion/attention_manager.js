
/**
 * AttentionManager
 *
 * Selects what the companion should focus on.
 * It does not execute Minecraft actions or modify goals.
 */
export class AttentionManager {
    constructor(options = {}) {
        this.eventLifetimeMs = options.eventLifetimeMs ?? 10000;
        this.pendingEvents = new Map();
    }

    addEvents(events = [], now = Date.now()) {
        for (const event of events) {
            if (!event || event.id == null) continue;

            // Do not repeatedly refresh the lifetime of an event
            // that is already waiting for attention.
            if (this.pendingEvents.has(event.id)) continue;

            this.pendingEvents.set(event.id, {
                ...event,
                expiresAt: now + this.eventLifetimeMs
            });
        }
    }

    removeExpiredEvents(now = Date.now()) {
        for (const [id, event] of this.pendingEvents) {
            if (event.expiresAt <= now) {
                this.pendingEvents.delete(id);
            }
        }
    }

    getBestEvent(events) {
        const threatTypes = new Set([
            'HOSTILE_DETECTED',
            'THREAT_APPROACHING'
        ]);

        const candidates = [...events.values()];

        // Immediate threats outrank ordinary world events.
        const threats = candidates
            .filter(event =>
                threatTypes.has(event.type) &&
                (
                    event.type === 'THREAT_APPROACHING' ||
                    event.data?.withinThreatRange === true
                )
            )
            .sort((a, b) => a.timestamp - b.timestamp);

        if (threats.length > 0) {
            return threats[0];
        }

        // Otherwise, prefer high-priority events, then normal events.
        const priorityValue = {
            high: 2,
            normal: 1
        };

        candidates.sort((a, b) => {
            const priorityDifference =
                (priorityValue[b.priority] ?? 0) -
                (priorityValue[a.priority] ?? 0);

            return priorityDifference || a.timestamp - b.timestamp;
        });

        return candidates[0] ?? null;
    }

    selectFocus(context = {}, now = Date.now()) {
        this.addEvents(context.events, now);
        this.removeExpiredEvents(now);

        // 1. Hard safety conditions.
        if (context.safety?.active === true) {
            return {
                type: 'SAFETY',
                priority: 100,
                reason: context.safety.reason ?? 'Safety condition active',
                data: context.safety
            };
        }

        const bestEvent = this.getBestEvent(this.pendingEvents);

        // 2. Immediate threat.
        if (
            bestEvent &&
            (
                bestEvent.type === 'THREAT_APPROACHING' ||
                (
                    bestEvent.type === 'HOSTILE_DETECTED' &&
                    bestEvent.data?.withinThreatRange === true
                )
            )
        ) {
            return {
                type: 'WORLD_EVENT',
                priority: 90,
                reason: 'Immediate threat detected',
                data: bestEvent
            };
        }

        // 3. Current player instruction.
        if (context.playerInstruction) {
            return {
                type: 'PLAYER_INSTRUCTION',
                priority: 80,
                reason: 'Respond to the player instruction',
                data: context.playerInstruction
            };
        }

        // 4. Active subgoal.
        if (context.activeSubgoal) {
            return {
                type: 'SUBGOAL',
                priority: 70,
                reason: 'Continue the active subgoal',
                data: context.activeSubgoal
            };
        }

        // 5. Active goal.
        if (context.activeGoal) {
            return {
                type: 'GOAL',
                priority: 60,
                reason: 'Continue the active goal',
                data: context.activeGoal
            };
        }

        // 6. Other important world events.
        if (bestEvent) {
            return {
                type: 'WORLD_EVENT',
                priority: bestEvent.priority === 'high' ? 50 : 30,
                reason: `Attend to ${bestEvent.type}`,
                data: bestEvent
            };
        }

        // 7. Optional agent-generated proposal.
        if (context.proposal) {
            return {
                type: 'PROPOSAL',
                priority: 10,
                reason: 'Consider an optional proposal',
                data: context.proposal
            };
        }

        return {
            type: 'IDLE',
            priority: 0,
            reason: 'No current focus',
            data: null
        };
    }

    acknowledgeEvent(eventId) {
        return this.pendingEvents.delete(eventId);
    }

    getPendingEvents() {
        return [...this.pendingEvents.values()];
    }

    clear() {
        this.pendingEvents.clear();
    }
}