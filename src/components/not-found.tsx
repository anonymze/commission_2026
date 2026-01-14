import { Link } from "@tanstack/react-router";

export function NotFound({ children }: { children?: any }) {
	return (
		<div className="space-y-2 p-2">
			<div className="text-gray-600 dark:text-gray-400">
				{children || <p>La page n'existe pas !</p>}
			</div>
			<p className="flex items-center gap-2 flex-wrap">
				<Link
					to="/dashboard"
					className="bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm"
				>
					Revenir à la page d'accueil
				</Link>
			</p>
		</div>
	);
}
