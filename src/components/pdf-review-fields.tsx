import { cloneElement, type ReactElement, useId, useState } from "react";
import { PdfFieldWarning } from "@/components/pdf-field-warning";
import { Input } from "@/components/ui/input";

const amountFormat = new Intl.NumberFormat("en-US", {
	useGrouping: false,
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
export const roundAmountOrNull = (value: number | null) =>
	value === null ? null : Number(amountFormat.format(value)) || 0;
export const money = (amount: number) =>
	new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
		amount,
	);

export function PdfAmountInput({
	value,
	onChange,
	className = "",
	...props
}: {
	id?: string;
	min?: number;
	max?: number;
	disabled?: boolean;
	title?: string;
	className?: string;
	"aria-label"?: string;
	"aria-required"?: boolean;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	value: number | null;
	onChange: (value: number | null) => void;
}) {
	const [draft, setDraft] = useState<string | null>(null);
	return (
		<Input
			{...props}
			type="number"
			step="0.01"
			className={`aria-invalid:border-red-600 aria-invalid:bg-red-50 dark:aria-invalid:border-red-400 dark:aria-invalid:bg-red-950/30 ${className}`}
			value={draft ?? (value === null ? "" : amountFormat.format(value))}
			onFocus={(event) => setDraft(event.target.value)}
			onChange={(event) => {
				const entered = event.target.value;
				setDraft(entered);
				onChange(roundAmountOrNull(entered === "" ? null : Number(entered)));
			}}
			onBlur={() => setDraft(null)}
		/>
	);
}

export function Field({
	label,
	children,
	required,
	error,
	hint,
	warnings = [],
	className = "",
}: {
	label: string;
	children: ReactElement<{
		id?: string;
		"aria-required"?: boolean;
		"aria-invalid"?: boolean;
		"aria-describedby"?: string;
	}>;
	required?: boolean;
	error?: string;
	hint?: string;
	warnings?: string[];
	className?: string;
}) {
	const id = useId();
	const errorId = `${id}-error`;
	return (
		<div
			className={`flex min-w-0 flex-col gap-1.5 text-sm ${className} ${warnings.length && !error ? "[&_input]:border-amber-500 [&_input]:bg-amber-50/40 dark:[&_input]:bg-amber-950/20" : ""}`}
		>
			<div className="flex flex-wrap items-center gap-2">
				<label htmlFor={id}>
					{label}
					{required && (
						<>
							{" "}
							<RequiredMark />
						</>
					)}
				</label>
				<PdfFieldWarning label={label} messages={warnings} />
			</div>
			{cloneElement(children, {
				id,
				"aria-required": required,
				"aria-invalid": !!error,
				"aria-describedby": error || hint ? errorId : undefined,
			})}
			{(error || hint) && (
				<p
					id={errorId}
					className={`text-xs ${error ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
				>
					{error || hint}
				</p>
			)}
		</div>
	);
}

export function RequiredMark() {
	return (
		<span aria-hidden="true" className="text-red-600 dark:text-red-400">
			*
		</span>
	);
}
