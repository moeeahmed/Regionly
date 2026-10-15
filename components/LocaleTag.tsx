import { getRegion } from "@/lib/regions";

export function LocaleTag({ code, light = false }: { code: string; light?: boolean }) {
  const r = getRegion(code);
  return (
    <span className={`loc ${light ? "light" : ""}`} title={r ? `${r.label}, ${r.language}` : code}>
      {r?.locale ?? code.toUpperCase()}
    </span>
  );
}
