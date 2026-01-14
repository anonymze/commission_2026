import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function TabSkeleton() {
	return (
		<Card>
			<CardContent className="space-y-4">
				<Skeleton className="h-8 w-1/3" />
				<Skeleton className="h-5 w-2/3" />
				<div className="space-y-2 pt-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />

				</div>
			</CardContent>
		</Card>
	);
}
