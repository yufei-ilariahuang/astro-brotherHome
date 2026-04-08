import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const categorySlugs = [
	'kitchen-cabinets',
	'hardwood-laminate-flooring',
	'quartz-countertops',
	'bathroom-vanities',
	'shower-doors',
	'shower-doors-enclosures',
	'sinks-and-pulls',
	'sinks-basins',
	'cabinet-hardware-pulls',
	'custom-walk-in-closets',
	'storage-cabinets',
	'pantry-storage',
] as const;

const products = defineCollection({
	loader: glob({ base: './src/content/products', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		category: z.enum(categorySlugs),
		sku: z.string().optional(),
		descriptionEn: z.string().optional(),
		descriptionZh: z.string().optional(),
		price: z.string().optional(),
		dimensions: z.string().optional(),
		material: z.string().optional(),
		status: z.enum(['available', 'sold']).default('available'),
		draft: z.boolean().optional().default(false),
		image: z.string().optional(),
		order: z.number().optional(),
	}),
});

export const collections = { products };
