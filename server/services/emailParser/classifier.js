/**
 * classifier.js
 *
 * Takes the merchant lookup result ({ category, subCategory }) and
 * resolves the names to real UUIDs from the DB.
 *
 * Returns: { category_id: UUID, sub_category_id: UUID|null }
 *          or null if categoryName not found in DB.
 *
 * Why fetch from DB instead of hardcoding UUIDs?
 * UUIDs are generated at seed time and differ between environments.
 * Name-based lookup is reliable as long as seeded names are consistent.
 *
 * Caching: A simple in-process Map is used so repeated calls within the
 * same fetchEmails() run don't hammer the DB. Cache is per-process and
 * cleared on restart — that's fine for this use case.
 */

import pool from "../../config/db.js";

// ─── In-process category cache ────────────────────────────────────────────────
// Structure: Map<categoryName_lower, { id, subs: Map<subName_lower, id> }>

let _cache = null;

async function loadCache() {
  if (_cache) return _cache;

  const result = await pool.query(`
    SELECT
      c.id   AS category_id,
      c.name AS category_name,
      s.id   AS sub_id,
      s.name AS sub_name
    FROM categories c
    LEFT JOIN sub_categories s ON s.category_id = c.id
    ORDER BY c.name, s.name
  `);

  _cache = new Map();

  for (const row of result.rows) {
    const catKey = row.category_name.toLowerCase();

    if (!_cache.has(catKey)) {
      _cache.set(catKey, { id: row.category_id, subs: new Map() });
    }

    if (row.sub_id) {
      const subKey = row.sub_name.toLowerCase();
      _cache.get(catKey).subs.set(subKey, row.sub_id);
    }
  }

  return _cache;
}

/** Call this to force a cache refresh (e.g. after adding new categories) */
export function clearClassifierCache() {
  _cache = null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Resolve category and sub-category names to DB UUIDs.
 *
 * @param {string}      categoryName
 * @param {string|null} subCategoryName
 * @returns {Promise<{ category_id: string, sub_category_id: string|null } | null>}
 *   null if categoryName is not found in DB (data issue or unknown category).
 */
export async function resolveIds(categoryName, subCategoryName) {
  if (!categoryName) return null;

  const cache = await loadCache();

  const catEntry = cache.get(categoryName.toLowerCase());
  if (!catEntry) {
    console.warn(`[Classifier] Category not found in DB: "${categoryName}"`);
    return null;
  }

  let subId = null;
  if (subCategoryName) {
    subId = catEntry.subs.get(subCategoryName.toLowerCase()) || null;
    if (!subId) {
      console.warn(
        `[Classifier] Sub-category "${subCategoryName}" not found ` +
          `under "${categoryName}" — will store null`
      );
    }
  }

  return {
    category_id: catEntry.id,
    sub_category_id: subId,
  };
}