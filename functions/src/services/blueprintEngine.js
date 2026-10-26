/**
 * Blueprint State Machine Engine (Firebase Cloud Functions)
 */

class BlueprintEngine {
    static validateTransition({
        blueprint,
        currentStateId,
        targetStateId,
        userRole,
        itemData,
        inputPrompts = {}
    }) {
        if (!blueprint) return { allowed: true };

        const transitions = blueprint.transitions || [];
        const transition = transitions.find(
            t => t.fromStateId === currentStateId && t.toStateId === targetStateId
        );

        if (!transition) {
            return {
                allowed: false,
                error: `Transition from "${currentStateId}" to "${targetStateId}" is not allowed in blueprint "${blueprint.name}".`
            };
        }

        if (transition.allowedRoles && transition.allowedRoles.length > 0) {
            if (!transition.allowedRoles.includes(userRole) && userRole !== 'admin') {
                return {
                    allowed: false,
                    error: `Role "${userRole}" is not authorized for transition "${transition.name}".`
                };
            }
        }

        if (transition.duringPrompts && transition.duringPrompts.length > 0) {
            for (const prompt of transition.duringPrompts) {
                if (prompt.required && (!inputPrompts[prompt.field] || String(inputPrompts[prompt.field]).trim() === '')) {
                    return {
                        allowed: false,
                        error: `Mandatory prompt "${prompt.label || prompt.field}" is required.`
                    };
                }
            }
        }

        return {
            allowed: true,
            transition
        };
    }

    static executePostActions(transition, item, inputPrompts = {}) {
        if (!transition || !transition.postActions) return {};

        const updates = {};
        for (const action of transition.postActions) {
            if (action.type === 'set_completion') {
                updates.completionPercentage = action.value;
                if (action.value === 100) {
                    updates.isCompleted = true;
                }
            } else if (action.type === 'set_field') {
                updates[action.field] = action.value;
            }
        }

        return updates;
    }
}

module.exports = BlueprintEngine;
