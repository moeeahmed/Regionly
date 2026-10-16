import { PGlite } from "@electric-sql/pglite";
import { setSqlForTests } from "../../lib/db";

/** Point the app's database layer at an in-memory Postgres, so the real queries run in tests. */
export function useMemoryDb() {
  const pg = new PGlite();
  const run = async (text: string, params: unknown[] = []) => (await pg.query(text, params as never[])).rows;
  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as unknown as Record<string, unknown>;
  tag.query = (text: string, params: unknown[] = []) => ({ text, params, then: (res: never, rej: never) => run(text, params).then(res, rej) });
  tag.transaction = async (queries: { text: string; params: unknown[] }[]) => {
    await pg.transaction(async (tx) => {
      for (const q of queries) await tx.query(q.text, q.params as never[]);
    });
  };
  setSqlForTests(tag as never);
  return pg;
}
