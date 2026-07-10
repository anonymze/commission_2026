import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		// queryCache: new QueryCache({
		// 	onError: errorHandler,
		// }),
		// mutationCache: new MutationCache({
		// 	onError: errorHandler,
		// }),

		defaultOptions: {
			queries: {
				// refetchOnReconnect: true,
				// refetchOnMount: true,
				// refetchOnWindowFocus: true,
				retry: 1,
				staleTime: 60 * 60 * 1000, // 60 minutes (donnée considérée fraîche)
				gcTime: 60 * 60 * 1000, // 60 minutes (cache gardé même page quittée)
			},
		},
	});
	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
