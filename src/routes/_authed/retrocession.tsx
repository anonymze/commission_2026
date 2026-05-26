import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	BadgePercentIcon,
	Loader2,
	PlusIcon,
	SaveIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { appUsersQueryOptions } from "@/api/queries/app-user-queries";
import {
	createRetrocessionQuery,
	deleteRetrocessionQuery,
	retrocessionsQueryOptions,
	updateRetrocessionQuery,
} from "@/api/queries/commission-queries";
import { SearchInput } from "@/components/search-input";
import { TabSkeleton } from "@/components/tab-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Retrocession, RetrocessionTier } from "@/types/retrocession";
import type { User } from "@/types/user";
import { userRoleLabels } from "@/types/user";

export const Route = createFileRoute("/_authed/retrocession")({
	component: RetrocessionTab,
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(appUsersQueryOptions()),
			context.queryClient.ensureQueryData(retrocessionsQueryOptions()),
		]);
	},
	pendingComponent: () => <TabSkeleton />,
});

type TierDraft = {
	key: string;
	from_amount: string;
	to_amount: string;
	rate_percent: string;
};

type RuleDraft = {
	id?: string;
	production_tiers: TierDraft[];
	encours_tiers: TierDraft[];
};

type Preset = {
	label: string;
	production_tiers: RetrocessionTier[];
	encours_tiers: RetrocessionTier[];
};

let draftKey = 0;

const PRESETS: Preset[] = [
	{
		label: "Règle 1",
		encours_tiers: [
			{ from_amount: 1, to_amount: 70000, rate_percent: 85 },
			{ from_amount: 70000, to_amount: null, rate_percent: 95 },
		],
		production_tiers: [
			{ from_amount: 1, to_amount: 50000, rate_percent: 80 },
			{ from_amount: 50000, to_amount: 75000, rate_percent: 85 },
			{ from_amount: 75000, to_amount: null, rate_percent: 90 },
		],
	},
	{
		label: "Règle 2",
		encours_tiers: [{ from_amount: 1, to_amount: null, rate_percent: 85 }],
		production_tiers: [
			{ from_amount: 1, to_amount: 50000, rate_percent: 75 },
			{ from_amount: 50000, to_amount: 75000, rate_percent: 80 },
			{ from_amount: 75000, to_amount: null, rate_percent: 90 },
		],
	},
	{
		label: "Règle 3",
		encours_tiers: [
			{ from_amount: 1, to_amount: 70000, rate_percent: 70 },
			{ from_amount: 70000, to_amount: null, rate_percent: 80 },
		],
		production_tiers: [
			{ from_amount: 1, to_amount: 50000, rate_percent: 50 },
			{ from_amount: 50000, to_amount: 75000, rate_percent: 60 },
			{ from_amount: 75000, to_amount: null, rate_percent: 80 },
		],
	},
];

function createDraftKey() {
	draftKey += 1;
	return `tier-${Date.now()}-${draftKey}`;
}

function numberToInput(value: number | null | undefined) {
	if (value === null || value === undefined) return "";
	return String(value);
}

function createTierDraft(tier?: RetrocessionTier): TierDraft {
	return {
		key: createDraftKey(),
		from_amount: numberToInput(tier?.from_amount),
		to_amount: numberToInput(tier?.to_amount),
		rate_percent: numberToInput(tier?.rate_percent),
	};
}

function createEmptyTierDraft(): TierDraft {
	return {
		key: createDraftKey(),
		from_amount: "1",
		to_amount: "",
		rate_percent: "",
	};
}

function createRuleDraft(retrocession: Retrocession): RuleDraft {
	return {
		id: retrocession.id,
		production_tiers: retrocession.production_tiers.map(createTierDraft),
		encours_tiers: retrocession.encours_tiers.map(createTierDraft),
	};
}

function createPresetDraft(preset: Preset, currentId?: string): RuleDraft {
	return {
		id: currentId,
		production_tiers: preset.production_tiers.map(createTierDraft),
		encours_tiers: preset.encours_tiers.map(createTierDraft),
	};
}

function getEmptyRuleDraft(currentId?: string): RuleDraft {
	return {
		id: currentId,
		production_tiers: [],
		encours_tiers: [],
	};
}

function findUserId(retrocession: Retrocession) {
	return retrocession.app_user.id;
}

function buildDrafts(retrocessions: Retrocession[]) {
	const drafts: Record<string, RuleDraft> = {};

	retrocessions.forEach((retrocession) => {
		drafts[findUserId(retrocession)] = createRuleDraft(retrocession);
	});

	return drafts;
}

function normalizeTiers(tiers: TierDraft[], label: string) {
	const normalized: RetrocessionTier[] = [];

	for (let index = 0; index < tiers.length; index++) {
		const tier = tiers[index];
		const fromAmount = Number(tier.from_amount);
		const toAmount = tier.to_amount.trim() ? Number(tier.to_amount) : null;
		const ratePercent = Number(tier.rate_percent);

		if (!Number.isFinite(fromAmount) || fromAmount < 0) {
			return {
				tiers: normalized,
				message: `${label}: montant de départ invalide ligne ${index + 1}`,
			};
		}

		if (
			toAmount !== null &&
			(!Number.isFinite(toAmount) || toAmount <= fromAmount)
		) {
			return {
				tiers: normalized,
				message: `${label}: montant de fin invalide ligne ${index + 1}`,
			};
		}

		if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
			return {
				tiers: normalized,
				message: `${label}: taux invalide ligne ${index + 1}`,
			};
		}

		normalized.push({
			from_amount: fromAmount,
			to_amount: toAmount,
			rate_percent: ratePercent,
		});
	}

	return {
		tiers: normalized.sort((a, b) => a.from_amount - b.from_amount),
		message: "",
	};
}

function extractDocId(data: unknown) {
	if (!data || typeof data !== "object") return null;

	if ("id" in data && typeof data.id === "string") {
		return data.id;
	}

	if ("doc" in data && data.doc && typeof data.doc === "object") {
		if ("id" in data.doc && typeof data.doc.id === "string") {
			return data.doc.id;
		}
	}

	return null;
}

function getDisplayName(user: User) {
	const fullName = `${user.lastname || ""} ${user.firstname || ""}`.trim();
	return fullName || user.email;
}

function RetrocessionTab() {
	const { queryClient } = Route.useRouteContext();
	const { data: usersData } = useSuspenseQuery(appUsersQueryOptions());
	const { data: retrocessionsData } = useSuspenseQuery(
		retrocessionsQueryOptions(),
	);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [drafts, setDrafts] = React.useState<Record<string, RuleDraft>>({});
	const [isInitialized, setIsInitialized] = React.useState(false);

	const users = usersData.docs || [];
	const retrocessions = retrocessionsData.docs || [];

	React.useEffect(() => {
		if (isInitialized) return;
		setDrafts(buildDrafts(retrocessions));
		setIsInitialized(true);
	}, [isInitialized, retrocessions]);

	const createMutation = useMutation({
		mutationFn: createRetrocessionQuery,
		onSuccess: (data, variables) => {
			const id = extractDocId(data);

			if (id) {
				setDrafts((current) => ({
					...current,
					[variables.data.app_user]: {
						...current[variables.data.app_user],
						id,
					},
				}));
			}

			queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
			toast.success("Rétrocession créée");
		},
		onError: () => {
			toast.error("Erreur lors de la création de la rétrocession");
		},
	});

	const updateMutation = useMutation({
		mutationFn: updateRetrocessionQuery,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
			toast.success("Rétrocession mise à jour");
		},
		onError: () => {
			toast.error("Erreur lors de la mise à jour de la rétrocession");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: deleteRetrocessionQuery,
		onSuccess: (_, variables) => {
			setDrafts((current) => {
				const next = { ...current };
				const userId = Object.keys(next).find(
					(id) => next[id].id === variables.data,
				);

				if (userId) {
					next[userId] = getEmptyRuleDraft();
				}

				return next;
			});
			queryClient.invalidateQueries({ queryKey: ["retrocessions"] });
			toast.success("Rétrocession supprimée");
		},
		onError: () => {
			toast.error("Erreur lors de la suppression de la rétrocession");
		},
	});

	const isOperating =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending;

	const filteredUsers = React.useMemo(() => {
		if (!searchQuery.trim()) return users;

		const lowerQuery = searchQuery.toLowerCase();

		return users.filter((user) => {
			const displayName = getDisplayName(user).toLowerCase();
			const email = user.email.toLowerCase();
			const role = userRoleLabels[user.role].toLowerCase();

			return (
				displayName.includes(lowerQuery) ||
				email.includes(lowerQuery) ||
				role.includes(lowerQuery)
			);
		});
	}, [searchQuery, users]);

	function getDraft(userId: string) {
		return drafts[userId] || getEmptyRuleDraft();
	}

	function updateDraft(
		userId: string,
		updater: (draft: RuleDraft) => RuleDraft,
	) {
		setDrafts((current) => ({
			...current,
			[userId]: updater(getDraft(userId)),
		}));
	}

	function applyPreset(userId: string, preset: Preset) {
		updateDraft(userId, (draft) => createPresetDraft(preset, draft.id));
	}

	function addTier(userId: string, type: "production_tiers" | "encours_tiers") {
		updateDraft(userId, (draft) => ({
			...draft,
			[type]: [...draft[type], createEmptyTierDraft()],
		}));
	}

	function removeTier(
		userId: string,
		type: "production_tiers" | "encours_tiers",
		key: string,
	) {
		updateDraft(userId, (draft) => ({
			...draft,
			[type]: draft[type].filter((tier) => tier.key !== key),
		}));
	}

	function updateTier(
		userId: string,
		type: "production_tiers" | "encours_tiers",
		key: string,
		field: "from_amount" | "to_amount" | "rate_percent",
		value: string,
	) {
		updateDraft(userId, (draft) => ({
			...draft,
			[type]: draft[type].map((tier) =>
				tier.key === key ? { ...tier, [field]: value } : tier,
			),
		}));
	}

	function saveRule(userId: string) {
		const draft = getDraft(userId);

		if (!draft.production_tiers.length || !draft.encours_tiers.length) {
			toast.error("Production et encours doivent avoir au moins une tranche");
			return;
		}

		const production = normalizeTiers(draft.production_tiers, "Production");
		if (production.message) {
			toast.error(production.message);
			return;
		}

		const encours = normalizeTiers(draft.encours_tiers, "Encours");
		if (encours.message) {
			toast.error(encours.message);
			return;
		}

		if (draft.id) {
			updateMutation.mutate({
				data: {
					app_user: userId,
					production_tiers: production.tiers,
					encours_tiers: encours.tiers,
					retrocessionId: draft.id,
				},
			});
			return;
		}

		createMutation.mutate({
			data: {
				app_user: userId,
				production_tiers: production.tiers,
				encours_tiers: encours.tiers,
			},
		});
	}

	function deleteRule(userId: string) {
		const draft = getDraft(userId);

		if (!draft.id) {
			setDrafts((current) => ({
				...current,
				[userId]: getEmptyRuleDraft(),
			}));
			return;
		}

		deleteMutation.mutate({ data: draft.id });
	}

	return (
		<Card>
			<CardHeader className="gap-0">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-2">
						<CardTitle className="flex items-center gap-2">
							<BadgePercentIcon className="w-5 h-5" />
							Rétrocession
						</CardTitle>
						<CardDescription>
							Gérez la règle courante de rétrocession pour chaque utilisateur.
						</CardDescription>
					</div>
					{isOperating && (
						<Loader2 className="h-5 w-5 animate-spin text-black" />
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<Alert className="items-center">
					<BadgePercentIcon className="h-4 w-4" />
					<AlertDescription>
						Les montants sont calculés à l'export, à partir des tranches
						marginales production et encours.
					</AlertDescription>
				</Alert>

				<div className="flex items-center justify-between gap-4">
					<SearchInput
						searchTerm={searchQuery}
						onSearchChange={setSearchQuery}
						placeholder="Rechercher un utilisateur..."
					/>
					<Badge variant="outline">{filteredUsers.length} utilisateurs</Badge>
				</div>

				<div className="space-y-4">
					{filteredUsers.map((user) => {
						const draft = getDraft(user.id);
						const isSaved = Boolean(draft.id);

						return (
							<div
								key={user.id}
								className="rounded-lg border bg-white p-4 shadow-sm space-y-4"
							>
								<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
									<div className="space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<h3 className="text-base font-semibold">
												{getDisplayName(user)}
											</h3>
											<Badge variant={isSaved ? "secondary" : "outline"}>
												{isSaved ? "Configurée" : "Non configurée"}
											</Badge>
											<Badge variant="outline">
												{userRoleLabels[user.role]}
											</Badge>
										</div>
										<p className="text-sm text-muted-foreground">
											{user.email}
										</p>
									</div>

									<div className="flex flex-wrap gap-2">
										{PRESETS.map((preset) => (
											<Button
												key={preset.label}
												type="button"
												variant="outline"
												size="sm"
												onClick={() => applyPreset(user.id, preset)}
												disabled={isOperating}
											>
												{preset.label}
											</Button>
										))}
										<Button
											type="button"
											size="sm"
											onClick={() => saveRule(user.id)}
											disabled={isOperating}
										>
											<SaveIcon className="h-4 w-4" />
											Enregistrer
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => deleteRule(user.id)}
											disabled={isOperating}
										>
											<Trash2Icon className="h-4 w-4" />
											Supprimer
										</Button>
									</div>
								</div>

								<div className="grid gap-4 xl:grid-cols-2">
									<TierEditor
										title="Production"
										tiers={draft.production_tiers}
										onAdd={() => addTier(user.id, "production_tiers")}
										onRemove={(key) =>
											removeTier(user.id, "production_tiers", key)
										}
										onChange={(key, field, value) =>
											updateTier(user.id, "production_tiers", key, field, value)
										}
										disabled={isOperating}
									/>
									<TierEditor
										title="Encours"
										tiers={draft.encours_tiers}
										onAdd={() => addTier(user.id, "encours_tiers")}
										onRemove={(key) =>
											removeTier(user.id, "encours_tiers", key)
										}
										onChange={(key, field, value) =>
											updateTier(user.id, "encours_tiers", key, field, value)
										}
										disabled={isOperating}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function TierEditor({
	title,
	tiers,
	onAdd,
	onRemove,
	onChange,
	disabled,
}: {
	title: string;
	tiers: TierDraft[];
	onAdd: () => void;
	onRemove: (key: string) => void;
	onChange: (
		key: string,
		field: "from_amount" | "to_amount" | "rate_percent",
		value: string,
	) => void;
	disabled: boolean;
}) {
	return (
		<div className="rounded-md border bg-gray-50 p-3 space-y-3">
			<div className="flex items-center justify-between gap-3">
				<Label className="text-sm font-semibold">{title}</Label>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={onAdd}
					disabled={disabled}
				>
					<PlusIcon className="h-4 w-4" />
					Tranche
				</Button>
			</div>

			{tiers.length === 0 ? (
				<div className="rounded-md border border-dashed bg-white p-4 text-sm text-muted-foreground">
					Aucune tranche.
				</div>
			) : (
				<div className="space-y-2">
					{tiers.map((tier) => (
						<div
							key={tier.key}
							className="grid grid-cols-12 gap-2 rounded-md border bg-white p-2"
						>
							<div className="col-span-3 space-y-1">
								<Label className="text-xs text-gray-600">De</Label>
								<Input
									type="number"
									min="0"
									step="0.01"
									value={tier.from_amount}
									onChange={(event) =>
										onChange(tier.key, "from_amount", event.target.value)
									}
									disabled={disabled}
									className="h-9"
								/>
							</div>
							<div className="col-span-3 space-y-1">
								<Label className="text-xs text-gray-600">À</Label>
								<Input
									type="number"
									min="0"
									step="0.01"
									placeholder="Illimité"
									value={tier.to_amount}
									onChange={(event) =>
										onChange(tier.key, "to_amount", event.target.value)
									}
									disabled={disabled}
									className="h-9"
								/>
							</div>
							<div className="col-span-4 space-y-1">
								<Label className="text-xs text-gray-600">Taux %</Label>
								<Input
									type="number"
									min="0"
									max="100"
									step="0.01"
									value={tier.rate_percent}
									onChange={(event) =>
										onChange(tier.key, "rate_percent", event.target.value)
									}
									disabled={disabled}
									className="h-9"
								/>
							</div>
							<div className="col-span-2 flex items-end justify-end">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={() => onRemove(tier.key)}
									disabled={disabled}
								>
									<Trash2Icon className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
