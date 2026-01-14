import type { Media } from "./media";

export interface Supplier {
	id: string;
	name: string;
	website?: string | null;
	logo_mini?: Media | null;
	logo_full?: Media | null;
	brochures?:
		| {
				name: string;
				brochure: Media;
				id?: string | null;
		  }[]
		| null;
	contact_info: {
		lastname?: string | null;
		firstname?: string | null;
		email?: string | null;
		phone?: string | null;
	};
	connexion: {
		email?: string | null;
		password?: string | null;
		remarques?: string | null;
	};
	pea?: {
		banque?: string | null;
		title_vif?: ("yes" | "no") | null;
		architecture_open?: ("yes" | "no") | null;
		fonds?: string | null;
		vp?: ("yes" | "no") | null;
		retrocession_gestion_libre?: string | null;
		retrocession_gestion_mandat?: string | null;
		passage_order?: string | null;
		interface?: string | null;
	};
	enveloppe?: {
		global?: number | null;
		amount?: number | null;
		reduction?: number | null;
		echeance?: string | null;
		actualisation?: string | null;
		commission?: string | null;
		commission_valorem?: string | null;
		droits?: ("yes" | "no") | null;
		agrement?: ("yes" | "no") | null;
		assurance?: ("yes" | "no" | "maybe") | null;
		investisseur?: ("yes" | "no") | null;
		close?: ("yes" | "no") | null;
		remarque?: string | null;
	};
	selection?: {
		selection?: boolean | null;
		category?: string | null;
		brochure?: null | Media;
	};
	other_information?:
		| {
				id?: string | null;
				scpi?: string | null;
				theme?: string | null;
				brochure?: Media | null;
				annotation?: string | null;
				epargne?: boolean | null;
				minimum_versement?: string | null;
				subscription_fee?: string | null;
				duration?: string | null;
				rentability_n1?: string | null;
				commission_offer_group_valorem?: string | null;
				commission_public_offer?: string | null;
		  }[]
		| null;
	fond?:
		| {
				id?: string | null;
				duration?: string | null;
				investment?: string | null;
				ticket?: string | null;
				duration_found?: string | null;
				distribution?: boolean | null;
				tri?: string | null;
				multiple?: string | null;
				eligibility?: string | null;
				upfront?: string | null;
				encours?: string | null;
				brochure?: Media | null;
		  }[]
		| null;
	updatedAt: string;
	createdAt: string;
}
