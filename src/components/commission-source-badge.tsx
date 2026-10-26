import { Badge } from "@/components/ui/badge";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export function CommissionSourceBadge({
	source,
	filename,
}: {
	source?: "pdf" | "excel";
	filename?: string;
}) {
	const label = source === "pdf" ? "PDF" : "Excel";
	const badge = (
		<Badge variant="secondary" className="text-[10px] font-medium">
			{label}
		</Badge>
	);
	if (!filename) return badge;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`Fichier source ${label}`}
					className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{badge}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-72 max-w-[calc(100vw-2rem)] break-all text-sm"
			>
				{filename}
			</PopoverContent>
		</Popover>
	);
}
