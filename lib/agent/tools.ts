import { Pool } from 'pg';
import { runReadOnly, getPool } from '../db';
import { checkSqlSafety } from '../serverUtils';


/**
 * Retrieves the database schema information.
 */
export async function inspectSchema(dbUrl?: string): Promise<string> {
  const pool = getPool(dbUrl);
  const query = `
    SELECT 
      table_name, 
      column_name, 
      data_type 
    FROM 
      information_schema.columns 
    WHERE 
      table_schema = 'public'
    ORDER BY 
      table_name, ordinal_position;
  `;
  
  const result = await pool.query(query);
  
  // Format schema as a string for the LLM
  const tables: Record<string, string[]> = {};
  result.rows.forEach(row => {
    if (!tables[row.table_name]) {
      tables[row.table_name] = [];
    }
    tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
  });
  
  return Object.entries(tables)
    .map(([table, columns]) => `Table: ${table}\nColumns: ${columns.join(', ')}`)
    .join('\n\n');
}

/**
 * Executes a SQL query with safety checks.
 */
export async function executeSql(sql: string, dbUrl?: string): Promise<any[]> {
  try {
    // 1. Deep SQL injection and write prevention checks
    checkSqlSafety(sql);
  } catch (error: any) {
    console.warn(`[SECURITY_ALERT] Blocked query execution: ${error.message}. Query: ${sql}`);
    throw error;
  }

  // 2. Output payload constraint: LIMIT 1000 enforcement
  let safeSql = sql.trim();
  if (safeSql.endsWith(';')) {
    safeSql = safeSql.slice(0, -1);
  }
  
  if (!/LIMIT\s+\d+/i.test(safeSql)) {
    safeSql += ' LIMIT 1000';
  }

  console.info(`[AUDIT] Initiating SQL execution.`);

  // 3. Read-Only Transaction execution
  const results = await runReadOnly(async (client) => {
    const result = await client.query({
      text: safeSql,
      rowMode: 'array', // Use array mode if needed, or default to objects
    });
    
    // Convert back to objects for easier handling in the state
    const fields = result.fields.map((f: any) => f.name);
    return result.rows.map((row: any) => {
      const obj: Record<string, any> = {};
      fields.forEach((field: string, i: number) => {
        obj[field] = row[i];
      });
      return obj;
    });
  }, dbUrl);

  console.info(`[AUDIT] SQL execution completed. Rows returned: ${results.length}`);
  return results;
}
