import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Regionly home">
      <span className="brand-mark" aria-hidden>R</span>
      Regionly
    </Link>
  );
}
