import {
	createFileRoute,
	Outlet,
	redirect,
	useMatchRoute,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import {
	BadgePercentIcon,
	CalculatorIcon,
	CodeIcon,
	Loader2,
	LogOutIcon,
	UploadIcon,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logoutLogic } from "@/lib/auth-client";
export const Route = createFileRoute("/_authed")({
	beforeLoad: (beforeLoadCtx) => {
		if (!beforeLoadCtx.context.userId)
			throw redirect({ to: "/login", replace: true });
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { queryClient } = Route.useRouteContext();
	const router = useRouter();
	const matchRoute = useMatchRoute();
	const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
	const [pendingTab, setPendingTab] = React.useState<string | null>(null);

	async function logout() {
		console.log("ici");
		await logoutLogic({ queryClient });
		router.invalidate();
	}

	const activeTab = matchRoute({ to: "/dashboard" })
		? "commissions"
		: router.matchRoute({ to: "/import" })
			? "import"
			: router.matchRoute({ to: "/user-code-mapping" })
				? "users"
				: router.matchRoute({ to: "/supplier-column-mapping" })
					? "suppliers"
					: router.matchRoute({ to: "/retrocession" })
						? "retrocession"
						: "commissions";

	React.useEffect(() => {
		if (!isRouterLoading) setPendingTab(null);
	}, [isRouterLoading]);

	const displayTab = pendingTab ?? activeTab;

	return (
		<React.Fragment>
			<div className="py-3 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold">Gestion des commissions</h1>
						<p className="text-muted-foreground">
							Gérez les commissions des employés, les imports, les calculs...
						</p>
					</div>
					<div className="flex gap-2">
						<Button variant="outline" onClick={logout}>
							<LogOutIcon className="w-4 h-4 mr-2" />
							Se déconnecter
						</Button>
					</div>
				</div>

				<Tabs value={displayTab} className="space-y-6">
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger
							value="commissions"
							className="flex items-center gap-2 text-blue-700"
							onClick={() => {
								setPendingTab("commissions");
								router.navigate({ to: "/dashboard" });
							}}
						>
							{pendingTab === "commissions" && isRouterLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<CalculatorIcon className="w-4 h-4" />
							)}
							Commissions
						</TabsTrigger>
						<TabsTrigger
							value="import"
							className="flex items-center gap-2 text-amber-700"
							onClick={() => {
								setPendingTab("import");
								router.navigate({ to: "/import" });
							}}
						>
							{pendingTab === "import" && isRouterLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<UploadIcon className="w-4 h-4" />
							)}
							Importer
						</TabsTrigger>
						<TabsTrigger
							value="users"
							className="flex items-center gap-2"
							onClick={() => {
								setPendingTab("users");
								router.navigate({ to: "/user-code-mapping" });
							}}
						>
							{pendingTab === "users" && isRouterLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<CodeIcon className="w-4 h-4" />
							)}
							Codes utilisateurs
						</TabsTrigger>
						<TabsTrigger
							value="suppliers"
							className="flex items-center gap-2"
							onClick={() => {
								setPendingTab("suppliers");
								router.navigate({ to: "/supplier-column-mapping" });
							}}
						>
							{pendingTab === "suppliers" && isRouterLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<CodeIcon className="w-4 h-4" />
							)}
							Colonnes des fournisseurs
						</TabsTrigger>
						<TabsTrigger
							value="retrocession"
							className="flex items-center gap-2"
							onClick={() => {
								setPendingTab("retrocession");
								router.navigate({ to: "/retrocession" });
							}}
						>
							{pendingTab === "retrocession" && isRouterLoading ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<BadgePercentIcon className="w-4 h-4" />
							)}
							Rétrocession
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<Outlet />
		</React.Fragment>
	);
}
