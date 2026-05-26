import type { User } from "./user";

export interface RetrocessionTier {
	id?: string | null;
	from_amount: number;
	to_amount?: number | null;
	rate_percent: number;
}

export interface Retrocession {
	id: string;
	app_user: User;
	production_tiers: RetrocessionTier[];
	encours_tiers: RetrocessionTier[];
	updatedAt: string;
	createdAt: string;
}

export interface RetrocessionPayload {
	app_user: User["id"];
	production_tiers: RetrocessionTier[];
	encours_tiers: RetrocessionTier[];
}
