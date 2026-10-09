
/**
 * InterruptionManager
 *
 * Records high-priority interruptions and preserves the objective
 * that was active when the interruption began.
 *
 * This module does not execute Minecraft actions or modify goals.
 */
export class InterruptionManager {
    constructor() {
        this.activeInterruption = null;
        this.history = [];
        this.nextInterruptionId = 1;
    }

    isEligibleEvent(event) {
        if (!event) return false;

        if (event.type === 'THREAT_APPROACHING') {
            return true;
        }

        return (
            event.type === 'HOSTILE_DETECTED' &&
            event.data?.withinThreatRange === true
        );
    }

    beginInterruption(event, goal = null, subgoal = null) {
        if (!this.isEligibleEvent(event)) {
            return null;
        }

        // Preserve the original interruption until it is explicitly resolved.
        // A second threat must not overwrite the original objective.
        if (this.activeInterruption) {
            return this.activeInterruption;
        }

        const interruption = {
            id: this.nextInterruptionId++,
            reason: event.type,
            eventId: event.id,
            startedAt: Date.now(),
            status: 'active',

            interruptedGoal: goal
                ? {
                    id: goal.id,
                    description: goal.description,
                    status: goal.status
                }
                : null,

            interruptedSubgoal: subgoal
                ? {
                    id: subgoal.id,
                    description: subgoal.description,
                    status: subgoal.status
                }
                : null
        };

        this.activeInterruption = interruption;
        this.history.push(interruption);

        return interruption;
    }

    resolveInterruption(reason = 'resolved') {
        if (!this.activeInterruption) {
            return false;
        }

        this.activeInterruption.status = 'resolved';
        this.activeInterruption.resolvedAt = Date.now();
        this.activeInterruption.resolutionReason = reason;

        this.activeInterruption = null;

        return true;
    }

    getState() {
        return {
            activeInterruption: this.activeInterruption,
            history: [...this.history]
        };
    }

    clear() {
        this.activeInterruption = null;
        this.history = [];
        this.nextInterruptionId = 1;
    }
}