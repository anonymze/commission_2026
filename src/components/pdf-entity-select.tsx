import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { PdfMatch } from "@/types/pdf-review";

export function PdfEntitySelect({
	label,
	value,
	options,
	match,
	disabled,
	required,
	onChange,
}: {
	label: string;
	value: string | null;
	options: { id: string; label: string }[];
	match?: PdfMatch;
	disabled?: boolean;
	required?: boolean;
	onChange: (id: string | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const candidates = match?.candidates || [];
	const candidateIds = new Set(candidates.map((candidate) => candidate.id));
	const selected = options.find((option) => option.id === value);
	return (
		<div className="min-w-0 space-y-1">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-label={label}
						aria-expanded={open}
						aria-required={required}
						disabled={disabled}
						className="w-full justify-between font-normal"
					>
						<span className="truncate">{selected?.label || "Choisir…"}</span>
						<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[min(420px,calc(100vw-3rem))] p-0"
					align="start"
				>
					<Command>
						<CommandInput placeholder={`Rechercher ${label.toLowerCase()}…`} />
						<CommandList>
							<CommandEmpty>Aucun résultat.</CommandEmpty>
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
								>
									Aucune sélection
								</CommandItem>
							</CommandGroup>
							{candidates.length > 0 && (
								<CommandGroup heading="Correspondances proposées">
									{candidates.map((candidate) => (
										<CommandItem
											key={candidate.id}
											value={`${candidate.label} ${candidate.id}`}
											onSelect={() => {
												onChange(candidate.id);
												setOpen(false);
											}}
										>
											<Check
												className={`mr-2 h-4 w-4 ${value === candidate.id ? "opacity-100" : "opacity-0"}`}
											/>
											<span>
												{candidate.label}
												<span className="block text-xs text-muted-foreground">
													{candidate.reason}
												</span>
											</span>
										</CommandItem>
									))}
								</CommandGroup>
							)}
							<CommandGroup heading="Tous les résultats">
								{options
									.filter((option) => !candidateIds.has(option.id))
									.map((option) => (
										<CommandItem
											key={option.id}
											value={`${option.label} ${option.id}`}
											onSelect={() => {
												onChange(option.id);
												setOpen(false);
											}}
										>
											<Check
												className={`mr-2 h-4 w-4 ${value === option.id ? "opacity-100" : "opacity-0"}`}
											/>
											{option.label}
										</CommandItem>
									))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			{!value && (
				<p className="text-xs text-muted-foreground">
					{match?.kind === "ambiguous"
						? "Plusieurs correspondances : choisissez la bonne."
						: candidates.length
							? "Suggestion à vérifier et à sélectionner."
							: "Aucune correspondance sélectionnée."}
				</p>
			)}
		</div>
	);
}
