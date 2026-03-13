import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	ChevronsUpDown,
	CodeIcon,
	Loader2,
	Plus,
	Save,
	Search,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { appUsersQueryOptions } from "@/api/queries/app-user-queries";
import {
	appUserCommissionsCodeQueryOptions,
	createAppUserCommissionCodeQuery,
	deleteAppUserCommissionCodeQuery,
} from "@/api/queries/commission-queries";
import { suppliersQueryOptions } from "@/api/queries/supplier-queries";
import { TabSkeleton } from "@/components/tab-skeleton";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/_authed/user-code-mapping")({
	component: UsersCodeTab,
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(appUsersQueryOptions()),
			context.queryClient.ensureQueryData(suppliersQueryOptions()),
			context.queryClient.ensureQueryData(appUserCommissionsCodeQueryOptions()),
		]);
	},
	pendingComponent: () => <TabSkeleton />,
});

export default function UsersCodeTab() {
	const { queryClient } = Route.useRouteContext();
	const [open, setOpen] = useState(false);
	const [supplierOpen, setSupplierOpen] = useState<Record<string, boolean>>({});
	const [searchQuery, setSearchQuery] = useState("");
	const [userCodeEntries, setUserCodeEntries] = useState<
		Record<
			string,
			Array<{ id: string; code: string; supplier: string; supplierName?: string }>
		>
	>({});
	const [userAssociationIds, setUserAssociationIds] = useState<
		Record<string, string>
	>({});

	const createUserCodeMutation = useMutation({
		mutationFn: createAppUserCommissionCodeQuery,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["app-user-commissions-code"],
			});
			toast.success("Code utilisateur créé avec succès");
		},
		onError: () => {
			toast.error(
				"Erreur lors de la création des codes. Attention à ne pas mettre plusieurs fois le même code.",
			);
		},
	});

	const deleteUserCodeMutation = useMutation({
		mutationFn: deleteAppUserCommissionCodeQuery,
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["app-user-commissions-code"],
			});

			// Remove the user from local state after successful deletion
			const deletedAssociationId = variables.data;
			const userIdToRemove = Object.keys(userAssociationIds).find(
				(uid) => userAssociationIds[uid] === deletedAssociationId,
			);

			if (userIdToRemove) {
				setUserCodeEntries((prev) => {
					const { [userIdToRemove]: removed, ...rest } = prev;
					return rest;
				});
				setUserAssociationIds((prev) => {
					const { [userIdToRemove]: removed, ...rest } = prev;
					return rest;
				});
			}

			toast.success("Association supprimée avec succès");
		},
		onError: () => {
			toast.error("Erreur lors de la suppression de l'association");
		},
	});

	const isOperating =
		createUserCodeMutation.isPending || deleteUserCodeMutation.isPending;

	const { data: users } = useSuspenseQuery(appUsersQueryOptions());
	const { data: suppliers } = useSuspenseQuery(suppliersQueryOptions());
	const { data: codeUsers } = useSuspenseQuery(
		appUserCommissionsCodeQueryOptions(),
	);

	const allUsers = users?.docs || [];
	const allSuppliers = suppliers?.docs || [];
	const existingCodeUsers = codeUsers?.docs || [];

	// Populate code entries from existing data
	useMemo(() => {
		if (existingCodeUsers.length > 0) {
			const existingData: Record<
				string,
				Array<{ id: string; code: string; supplier: string }>
			> = {};
			const associationIds: Record<string, string> = {};

			existingCodeUsers.forEach((codeUser) => {
				if (codeUser.app_user?.id && codeUser.code.length > 0) {
					const userId = codeUser.app_user.id;
					associationIds[userId] = codeUser.id; // Store association ID
					existingData[userId] = codeUser.code.map((codeItem, index) => ({
						id: `${userId}-${index}`,
						code: codeItem.code,
						supplier: codeItem.supplier?.id || "",
						supplierName: codeItem.supplier?.name || "",
					}));
				}
			});

			setUserCodeEntries(existingData);
			setUserAssociationIds(associationIds);
		}
	}, [existingCodeUsers]);

	const handleUserAdd = (userId: string) => {
		if (!userCodeEntries[userId]) {
			// Initialize with one empty code entry
			setUserCodeEntries((prev) => ({
				...prev,
				[userId]: [
					{
						id: `${userId}-0`,
						code: "",
						supplier: "",
					},
				],
			}));
		}
		setOpen(false);
	};

	// Get available users (not yet selected)
	const availableUsers = useMemo(() => {
		const selectedUserIds = Object.keys(userCodeEntries);
		return allUsers.filter((user) => !selectedUserIds.includes(user.id));
	}, [allUsers, userCodeEntries]);

	// Sort selected user IDs: newly added first, then existing sorted by lastname, with search filter
	const sortedUserIds = useMemo(() => {
		const userIds = Object.keys(userCodeEntries);
		const existingUserIds = new Set(
			existingCodeUsers.map((cu) => cu.app_user?.id).filter(Boolean),
		);

		// Separate into newly added and existing
		const newlyAdded = userIds.filter((id) => !existingUserIds.has(id));
		const existing = userIds.filter((id) => existingUserIds.has(id));

		// Sort existing by lastname
		const sortedExisting = existing.sort((a, b) => {
			const userA = allUsers.find((u) => u.id === a);
			const userB = allUsers.find((u) => u.id === b);
			const lastNameA = (userA?.lastname || "").toLowerCase();
			const lastNameB = (userB?.lastname || "").toLowerCase();
			return lastNameA.localeCompare(lastNameB);
		});

		// Newly added first, then sorted existing
		const allSorted = [...newlyAdded, ...sortedExisting];

		// Filter by search query
		if (!searchQuery.trim()) return allSorted;

		const lowerQuery = searchQuery.toLowerCase();
		return allSorted.filter((id) => {
			const user = allUsers.find((u) => u.id === id);
			const firstname = (user?.firstname || "").toLowerCase();
			const lastname = (user?.lastname || "").toLowerCase();
			const email = (user?.email || "").toLowerCase();

			return (
				firstname.includes(lowerQuery) ||
				lastname.includes(lowerQuery) ||
				email.includes(lowerQuery) ||
				`${firstname} ${lastname}`.includes(lowerQuery) ||
				`${lastname} ${firstname}`.includes(lowerQuery)
			);
		});
	}, [userCodeEntries, allUsers, existingCodeUsers, searchQuery]);

	const addCodeEntry = (userId: string) => {
		setUserCodeEntries((prev) => {
			const currentEntries = prev[userId] || [];
			const newEntry = {
				id: `${userId}-${currentEntries.length}`,
				code: "",
				supplier: "",
			};
			return {
				...prev,
				[userId]: [...currentEntries, newEntry],
			};
		});
	};

	const removeCodeEntry = (userId: string, entryId: string) => {
		setUserCodeEntries((prev) => {
			const currentEntries = prev[userId] || [];
			const updatedEntries = currentEntries.filter(
				(entry) => entry.id !== entryId,
			);

			return {
				...prev,
				[userId]: updatedEntries,
			};
		});
	};

	const updateCodeEntry = (
		userId: string,
		entryId: string,
		field: "code" | "supplier",
		value: string,
	) => {
		setUserCodeEntries((prev) => {
			const currentEntries = prev[userId] || [];
			return {
				...prev,
				[userId]: currentEntries.map((entry) =>
					entry.id === entryId ? { ...entry, [field]: value } : entry,
				),
			};
		});
	};

	const getAvailableSuppliers = (userId: string, currentEntryId: string) => {
		const userEntries = userCodeEntries[userId] || [];
		const usedSupplierIds = userEntries
			.filter((entry) => entry.id !== currentEntryId && entry.supplier)
			.map((entry) => entry.supplier);

		return allSuppliers.filter(
			(supplier) => !usedSupplierIds.includes(supplier.id),
		);
	};

	const saveUserCode = (userId: string) => {
		const entries = userCodeEntries[userId] || [];
		const associationId = userAssociationIds[userId];

		// If all codes deleted and association exists, delete it
		if (entries.length === 0 && associationId) {
			deleteUserCodeMutation.mutate({ data: associationId });
			return;
		}

		if (entries.length === 0) {
			toast.error("Veuillez ajouter au moins un code");
			return;
		}

		for (const entry of entries) {
			if (!entry.code || !entry.code.trim()) {
				toast.error("Veuillez entrer tous les codes");
				return;
			}
			if (!entry.supplier) {
				toast.error("Veuillez sélectionner tous les fournisseurs");
				return;
			}
		}

		createUserCodeMutation.mutate({
			data: {
				app_user: userId,
				code: entries.map((entry) => ({
					code: entry.code.trim(),
					id: null,
					supplier: entry.supplier,
				})),
			},
		});
	};

	return (
		<Card>
			<CardHeader className="gap-0">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-2">
						<CardTitle className="flex items-center gap-2">
							<CodeIcon className="w-5 h-5" />
							Mapping des codes utilisateurs
						</CardTitle>
						<CardDescription>
							Associez un utilisateur à des codes uniques de commission avec
							leurs fournisseurs correspondants.
						</CardDescription>
					</div>
					{isOperating && (
						<Loader2 className="h-5 w-5 animate-spin text-black" />
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* User Selection & Search */}
				<div className="flex items-center justify-between gap-4">
					<Popover open={open} onOpenChange={setOpen}>
						<PopoverTrigger asChild>
							<Button
								variant="outline"
								role="combobox"
								aria-expanded={open}
								className="w-[300px] justify-between"
							>
								Sélectionner un utilisateur...
								<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[300px] p-0">
							<Command>
								<CommandInput placeholder="Rechercher un utilisateur..." />
								<CommandEmpty>Aucun utilisateur disponible</CommandEmpty>
								<CommandGroup className="max-h-[230px] overflow-auto">
									{availableUsers.map((user) => {
										const fullName =
											`${user.lastname || ""} ${user.firstname || ""}`.trim();
										const displayName = fullName || user.email;
										return (
											<CommandItem
												key={user.id}
												value={`${fullName} ${user.email}`}
												onSelect={() => handleUserAdd(user.id)}
											>
												<div className="flex flex-col">
													<span className="font-medium">{displayName}</span>
													{fullName && (
														<span className="text-xs text-gray-500">
															{user.email}
														</span>
													)}
												</div>
											</CommandItem>
										);
									})}
								</CommandGroup>
							</Command>
						</PopoverContent>
					</Popover>

					{Object.keys(userCodeEntries).length > 0 && (
						<div className="relative w-[300px]">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Rechercher..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
					)}
				</div>

				{/* Selected Users Display */}
				{Object.keys(userCodeEntries).length > 0 && (
					<div className="space-y-3">
						<Label className="text-base font-semibold text-gray-800">
							Utilisateurs sélectionnés ({Object.keys(userCodeEntries).length})
						</Label>
						<div className="space-y-6">
							{sortedUserIds.map((userId) => {
								const user = allUsers.find((u) => u.id === userId);
								const firstName = user?.firstname || "";
								const lastName = user?.lastname || "";
								const fullName = `${lastName} ${firstName}`.trim();
								const displayName =
									fullName || user?.email || "Utilisateur inconnu";
								const userEmail = user?.email;
								const codeCount = (userCodeEntries[userId] || []).length;

								return (
									<div
										key={userId}
										className="p-5 bg-linear-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl space-y-4 shadow-sm"
									>
										{/* User Header */}
										<div className="flex flex-col space-y-1 pb-3 border-b border-blue-300">
											<div className="flex items-center justify-between">
												<h3 className="text-lg font-semibold text-gray-900">
													{displayName}
												</h3>
												<span className="text-xs bg-blue-200 px-2 py-1 rounded-full font-medium text-blue-800">
													{codeCount} {codeCount === 1 ? "code" : "codes"}
												</span>
											</div>
											{fullName && userEmail && (
												<span className="text-sm text-gray-600">
													{userEmail}
												</span>
											)}
										</div>

										{/* Code Entries */}
										<div className="space-y-3">
											<Label className="text-sm font-medium text-gray-700">
												Codes & Fournisseurs
											</Label>

											{(userCodeEntries[userId] || []).length === 0 ? (
												<div className="text-center py-6">
													{userAssociationIds[userId] ? (
														<div className="space-y-2">
															<p className="text-orange-600 font-medium text-sm">
																Toutes les associations ont été supprimées
															</p>
															<p className="text-gray-500 text-xs">
																Cliquez sur "Supprimer" pour confirmer la
																suppression définitive
															</p>
														</div>
													) : (
														<p className="text-gray-500 text-sm">
															Aucun code ajouté. Cliquez sur "Ajouter un code"
															pour commencer.
														</p>
													)}
												</div>
											) : (
												(userCodeEntries[userId] || []).map((entry) => (
													<div
														key={entry.id}
														className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors"
													>
														<div className="flex items-center gap-3">
															{/* Code Input */}
															<div className="flex-1">
																<Label className="text-xs text-gray-600 mb-1 block">
																	Code
																</Label>
																<Input
																	placeholder="Ex: ABC123"
																	value={entry.code}
																	onChange={(e) =>
																		updateCodeEntry(
																			userId,
																			entry.id,
																			"code",
																			e.target.value,
																		)
																	}
																	className="h-10"
																	required
																/>
															</div>

															{/* Arrow Separator */}
															<div className="text-gray-400 mt-6">→</div>

															{/* Supplier Selection */}
															<div className="flex-1">
																<Label className="text-xs text-gray-600 mb-1 block">
																	Fournisseur
																</Label>
																<Popover
																	open={supplierOpen[`${userId}-${entry.id}`]}
																	onOpenChange={(open) =>
																		setSupplierOpen((prev) => ({
																			...prev,
																			[`${userId}-${entry.id}`]: open,
																		}))
																	}
																>
																	<PopoverTrigger asChild>
																		<Button
																			variant="outline"
																			role="combobox"
																			className="h-10 w-full justify-between text-sm"
																		>
																			{entry.supplier
																				? allSuppliers.find(
																						(s) => s.id === entry.supplier,
																					)?.name ||
																					entry.supplierName ||
																					"Fournisseur inconnu"
																				: "Sélectionner..."}
																			<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
																		</Button>
																	</PopoverTrigger>
																	<PopoverContent className="w-[250px] p-0">
																		<Command>
																			<CommandInput placeholder="Rechercher..." />
																			<CommandEmpty>
																				Aucun fournisseur trouvé
																			</CommandEmpty>
																			<CommandGroup className="max-h-[200px] overflow-auto">
																				{getAvailableSuppliers(
																					userId,
																					entry.id,
																				).map((supplier) => (
																					<CommandItem
																						key={supplier.id}
																						value={supplier.name}
																						onSelect={() => {
																							updateCodeEntry(
																								userId,
																								entry.id,
																								"supplier",
																								supplier.id,
																							);
																							setSupplierOpen((prev) => ({
																								...prev,
																								[`${userId}-${entry.id}`]: false,
																							}));
																						}}
																					>
																						{supplier.name}
																					</CommandItem>
																				))}
																			</CommandGroup>
																		</Command>
																	</PopoverContent>
																</Popover>
															</div>

															{/* Remove button */}
															<Button
																onClick={() =>
																	removeCodeEntry(userId, entry.id)
																}
																variant="ghost"
																size="sm"
																className="h-10 w-10 p-0 mt-6 text-red-600 hover:text-red-700 hover:bg-red-50"
																title="Supprimer cette association"
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</div>
												))
											)}
										</div>

										{/* Action Buttons */}
										<div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-300">
											<Button
												onClick={() => addCodeEntry(userId)}
												variant="outline"
												size="default"
												className="flex-1 h-10"
											>
												<Plus className="h-4 w-4 mr-2" />
												Ajouter un code
											</Button>
											<Button
												onClick={() => saveUserCode(userId)}
												disabled={
													createUserCodeMutation.isPending ||
													deleteUserCodeMutation.isPending ||
													(codeCount === 0 && !userAssociationIds[userId])
												}
												size="default"
												className="flex-1 h-10"
											>
												<Save className="h-4 w-4 mr-2" />
												{codeCount === 0 && userAssociationIds[userId]
													? "Supprimer"
													: "Sauvegarder"}
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
