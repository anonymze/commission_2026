import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import React from "react";
import LogoImg from "@/assets/images/logo.png";
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
import { loginLogic } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const { queryClient } = Route.useRouteContext();
	const navigate = useNavigate();
	const [error, setError] = React.useState<string | null>(null);
	const [showPassword, setShowPassword] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setIsLoading(true);
			try {
				const result = await loginLogic({
					email: value.email,
					password: value.password,
					queryClient,
				});

				if (result.error) {
					setError("Vos identifiants sont incorrects.");
					setIsLoading(false);
					return;
				}

				navigate({ to: "/dashboard", replace: true });
			} catch (err) {
				setError("Une erreur est survenue lors de la connexion.");
				setIsLoading(false);
			}
		},
	});

	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="w-full max-w-md space-y-6">
				{/* Logo/Header */}
				<div className="text-center space-y-2">
					<div className="flex justify-center">
						<img src={LogoImg} alt="Logo" className="w-16 h-16 text-white" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900">
						Gestionnaire de commissions pour le Groupe Valorem
					</h1>
				</div>

				{/* Login Card */}
				<Card className="shadow-lg">
					<CardHeader className="space-y-1">
						<CardTitle className="text-xl text-center">Bienvenue,</CardTitle>
						<CardDescription className="text-center">
							Entrez vos identifiants pour accéder au système de gestion des
							commissions.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="space-y-6"
						>
							<form.Field
								name="email"
								validators={{
									onSubmit: ({ value }) => {
										if (!value) return "Veuillez entrer votre email";
										if (!value.includes("@"))
											return "Veuillez entrer une adresse email valide";
										return undefined;
									},
								}}
							>
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="email">Email :</Label>
										<div className="relative">
											<Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												id="email"
												type="email"
												placeholder="Entrez votre email"
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												className="pl-10"
												disabled={isLoading}
												required
											/>
										</div>
									</div>
								)}
							</form.Field>

							<form.Field
								name="password"
								validators={{
									onSubmit: ({ value }) => {
										if (!value) return "Veuillez entrer votre mot de passe";
										return undefined;
									},
								}}
							>
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="password">Mot de passe :</Label>
										<div className="relative">
											<Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
											<Input
												id="password"
												type={showPassword ? "text" : "password"}
												placeholder="Entrez votre mot de passe"
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												className="pl-10 pr-10"
												disabled={isLoading}
												required
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
												onClick={() => setShowPassword(!showPassword)}
												disabled={isLoading}
											>
												{showPassword ? (
													<EyeOff className="h-4 w-4 text-gray-400" />
												) : (
													<Eye className="h-4 w-4 text-gray-400" />
												)}
											</Button>
										</div>
									</div>
								)}
							</form.Field>

							{error && (
								<p className="absolute -translate-y-3.5 text-sm text-red-600">
									{error}
								</p>
							)}

							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting]}
							>
								{([canSubmit, _]) => (
									<Button
										type="submit"
										className="w-full mt-4"
										disabled={!canSubmit || isLoading}
									>
										{isLoading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Connexion en cours...
											</>
										) : (
											"Se connecter"
										)}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</CardContent>
				</Card>

				{/* Footer */}
				<div className="text-center text-sm text-gray-500">
					<p>
						© {new Date().getFullYear()} Groupe Valorem. Tous droits réservés.
					</p>
				</div>
			</div>
		</div>
	);
}
