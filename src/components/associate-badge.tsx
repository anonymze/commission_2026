import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/user";

export function AssociateBadge({ role }: { role?: User["role"] | null }) {
	if (role !== "associate") return null;

	return (
		<Badge
			variant="outline"
			className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
		>
			Associé
		</Badge>
	);
}
