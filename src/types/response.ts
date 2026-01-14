export interface PaginatedResponse<T> {
	docs: T[];
	hasNextPage: boolean;
	hasPrevPage: boolean;
	limit: number;
	nextPage: number | null;
	page: number;
	pagingCounter: number;
	prevPage: number | null;
	totalDocs: number;
	totalPages: number;
}

export interface SuccessCreateResponse<T> {
	doc: T;
	message: string;
}
