export interface Media {
	id: string;
	alt: string;
	updatedAt: string;
	createdAt: string;
	prefix?: string | null;
	url?: string | null;
	blurhash?: string | null;
	thumbnailURL?: string | null;
	filename?: string | null;
	mimeType?: string | null;
	filesize?: number | null;
	width?: number | null;
	height?: number | null;
	focalX?: number | null;
	focalY?: number | null;
}
