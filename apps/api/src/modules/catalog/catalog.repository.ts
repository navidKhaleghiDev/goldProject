import type { ProductDto, ProductListDto } from '@sheri-gold/contracts';
import { pool } from '../../database/pool.js';
import type { z } from 'zod';
import type { productListQuerySchema } from './catalog.schema.js';

type ProductListQuery = z.infer<typeof productListQuerySchema>;

interface ProductRow {
  id: string;
  code: string;
  name: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  category_parent_id: string | null;
  short_description: string;
  description: string;
  price_toman: string;
  weight_grams: string | null;
  purity: string | null;
  availability: 'available' | 'unavailable';
  updated_at: Date;
  total_count: string;
  images: Array<{ id: string; url: string; alt: string; position: number }> | null;
}

function mapProduct(row: ProductRow): ProductDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      parentId: row.category_parent_id,
    },
    shortDescription: row.short_description,
    description: row.description,
    priceToman: Number(row.price_toman),
    weightGrams: row.weight_grams === null ? null : Number(row.weight_grams),
    purity: row.purity,
    availability: row.availability,
    images: row.images ?? [],
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listProducts(query: ProductListQuery): Promise<ProductListDto> {
  const values: unknown[] = [];
  const conditions = ['p.published_at IS NOT NULL', 'p.archived_at IS NULL'];

  if (query.q) {
    values.push(`%${query.q}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.code ILIKE $${values.length})`);
  }
  if (query.category) {
    values.push(query.category);
    conditions.push(`c.slug = $${values.length}`);
  }
  if (query.availability) {
    values.push(query.availability);
    conditions.push(`p.availability = $${values.length}`);
  }

  values.push(query.pageSize, (query.page - 1) * query.pageSize);
  const limitIndex = values.length - 1;
  const offsetIndex = values.length;
  const order = query.sort === 'price_desc' ? 'DESC' : 'ASC';

  const result = await pool.query<ProductRow>(
    `SELECT
       p.id, p.code, p.name, p.short_description, p.description, p.price_toman,
       p.weight_grams, p.purity, p.availability, p.updated_at,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
       c.parent_id AS category_parent_id,
       COUNT(*) OVER() AS total_count,
       COALESCE(
         json_agg(json_build_object('id', pi.id, 'url', pi.url, 'alt', pi.alt, 'position', pi.position)
           ORDER BY pi.position) FILTER (WHERE pi.id IS NOT NULL),
         '[]'::json
       ) AS images
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN product_images pi ON pi.product_id = p.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, c.id
     ORDER BY p.price_toman ${order}, p.id ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    values
  );

  const total = Number(result.rows[0]?.total_count ?? 0);
  return {
    items: result.rows.map(mapProduct),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}
