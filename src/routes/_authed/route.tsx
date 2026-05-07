import {
	createFileRoute,
	Outlet,
	redirect,
	useMatchRoute,
	useRouter,
} from "@tanstack/react-router";
import { CalculatorIcon, CodeIcon, LogOutIcon, UploadIcon } from "lucide-react";
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

	async function logout() {
		console.log("ici")
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
					: "commissions";

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

				<Tabs value={activeTab} className="space-y-6">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger
							value="commissions"
							className="flex items-center gap-2 text-blue-700"
							onClick={() => {
								router.navigate({ to: "/dashboard" });
							}}
						>
							<CalculatorIcon className="w-4 h-4" />
							Commissions
						</TabsTrigger>
						<TabsTrigger
							value="import"
							className="flex items-center gap-2 text-amber-700"
							onClick={() => {
								router.navigate({ to: "/import" });
							}}
						>
							<UploadIcon className="w-4 h-4" />
							Importer
						</TabsTrigger>
						<TabsTrigger
							value="users"
							className="flex items-center gap-2"
							onClick={() => {
								router.navigate({ to: "/user-code-mapping" });
							}}
						>
							<CodeIcon className="w-4 h-4" />
							Codes utilisateurs
						</TabsTrigger>
						<TabsTrigger
							value="suppliers"
							className="flex items-center gap-2"
							onClick={() => {
								router.navigate({ to: "/supplier-column-mapping" });
							}}
						>
							<CodeIcon className="w-4 h-4" />
							Colonnes des fournisseurs
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<Outlet />
		</React.Fragment>
	);
}
