import { ActionCost, ActionUseOptions } from "./types";
import { ActorPF2e } from "@actor";
import { getSelectedOrOwnActors } from "@util/token-actor-utils";
import { BaseAction, BaseActionData, BaseActionVariant, BaseActionVariantData } from "./base";
import { EffectPF2e } from "@item";

interface SimpleActionVariantData extends BaseActionVariantData {
    effect?: string | EffectPF2e;
}

interface SimpleActionData extends BaseActionData<SimpleActionVariantData> {
    effect?: string | EffectPF2e;
}

interface SimpleActionUseOptions extends ActionUseOptions {
    actors: ActorPF2e[];
    cost: ActionCost;
    effect: string | EffectPF2e;
    traits: string[];
}

async function toEffectItem(effect?: string | EffectPF2e) {
    return typeof effect === "string" ? await fromUuid(effect) : effect;
}

class SimpleActionVariant extends BaseActionVariant {
    readonly #action: SimpleAction;
    readonly #effect?: string | EffectPF2e;

    constructor(action: SimpleAction, data?: SimpleActionVariantData) {
        super(action, data);
        this.#action = action;
        this.#effect = data?.effect ?? action.effect;
    }

    get effect() {
        return this.#effect ?? this.#action.effect;
    }

    override async use(options: Partial<SimpleActionUseOptions> = {}) {
        const actors: ActorPF2e[] = [];
        if (Array.isArray(options.actors)) {
            actors.push(...options.actors);
        } else if (options.actors) {
            actors.push(options.actors);
        } else {
            actors.push(...getSelectedOrOwnActors());
        }
        if (actors.length === 0) {
            return ui.notifications.warn(game.i18n.localize("PF2E.ActionsWarning.NoActor"));
        }

        const traitLabels: Record<string, string | undefined> = CONFIG.PF2E.actionTraits;
        const traitDescriptions: Record<string, string | undefined> = CONFIG.PF2E.traitsDescriptions;
        const traits = this.traits.concat(options.traits ?? []).map((trait) => ({
            description: traitDescriptions[trait],
            label: traitLabels[trait] ?? trait,
            slug: trait,
        }));
        const effect = await toEffectItem(this.effect);
        const name = this.name ? `${this.#action.name} - ${this.name}` : this.#action.name;
        const flavor = await renderTemplate("systems/pf2e/templates/system/actions/simple/chat-message-flavor.hbs", {
            effect,
            glyph: this.glyph,
            name,
            traits,
        });
        const messages = [];
        for (const actor of actors) {
            messages.push({
                flavor,
                speaker: ChatMessage.getSpeaker({ actor }),
            });
            if (effect && actor.isOwner) {
                await actor.createEmbeddedDocuments("Item", [effect.toObject()]);
            }
        }
        await ChatMessage.create(messages);
    }
}

class SimpleAction extends BaseAction<SimpleActionVariantData, SimpleActionVariant> {
    readonly effect?: string | EffectPF2e;

    public constructor(data: SimpleActionData) {
        super(data);
        this.effect = data.effect;
    }

    protected override toActionVariant(data?: SimpleActionVariantData): SimpleActionVariant {
        return new SimpleActionVariant(this, data);
    }
}

export { SimpleAction, SimpleActionVariantData };