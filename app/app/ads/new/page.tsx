import Link from "next/link";
import { UploadAd } from "@/components/UploadAd";

export default function NewAd() {
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/app" className="back">Back to ads</Link>
          <h1>Upload an ad</h1>
          <p className="sub">Use an ad that&apos;s already performing. The notes you add here guide how it&apos;s rewritten for each market.</p>
        </div>
      </div>
      <UploadAd />
    </>
  );
}
