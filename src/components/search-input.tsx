import { SearchIcon, XIcon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
	searchTerm: string;
	onSearchChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
}

export const SearchInput = ({
	searchTerm,
	onSearchChange,
	placeholder = "Rechercher...",
	disabled = false,
}: SearchInputProps) => {
	const inputRef = React.useRef<HTMLInputElement>(null);

	const handleClear = () => {
		if (inputRef.current) {
			inputRef.current.value = "";
		}
		onSearchChange("");
	};

	return (
		<div className="flex items-center space-x-2 max-w-sm">
			<SearchIcon className="w-4 h-4 text-muted-foreground" />
			<div className="relative">
				<Input
					ref={inputRef}
					placeholder={placeholder}
					defaultValue={searchTerm}
					onChange={(e) => onSearchChange(e.target.value)}
					className="h-8 pr-8"
					disabled={disabled}
				/>
				{searchTerm && (
					<Button
						variant="ghost"
						size="sm"
						onClick={handleClear}
						className="absolute right-0 top-0 h-8 w-8 p-0 hover:bg-transparent"
						disabled={disabled}
					>
						<XIcon className="h-3 w-3 text-gray-400 hover:text-gray-600" />
					</Button>
				)}
			</div>
		</div>
	);
};
