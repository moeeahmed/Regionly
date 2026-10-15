import "../landing.css";
import "../site.css";
import { SiteFooter, SiteNav } from "@/components/marketing/SiteChrome";
import { Reveal } from "@/components/landing/Reveal";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp">
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      <Reveal />
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
