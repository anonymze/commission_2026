import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

export function PdfFieldWarning({
	messages,
	label,
}: {
	messages: string[];
	label: string;
}) {
	if (!messages.length) return null;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`Pourquoi vérifier ${label} ?`}
					className="shrink-0 rounded-full border border-amber-400/50 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
				>
					À vérifier
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-72 max-w-[calc(100vw-2rem)] space-y-2 text-sm"
				align="start"
			>
				{[...new Set(messages)].map((message) => (
					<p key={message}>{message}</p>
				))}
			</PopoverContent>
		</Popover>
	);
}
