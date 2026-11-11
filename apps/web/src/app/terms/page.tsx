import { MarketingShell } from "@/components/marketing/MarketingShell";
import { productName } from "@/lib/product";

export default function TermsPage() {
  return (
    <MarketingShell title="Terms of service" lead="Last updated 11 November 2026. Template text — have counsel review before launch.">
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Your content</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          You keep ownership of scenes, assets and renders you create. You grant {productName} the limited licence needed to
          store, process and render that content on your behalf. You are responsible for having the rights to any asset you
          upload, including character likenesses and music.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Model output</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Generative features are provided by third-party models with their own licences and restrictions. Output may be subject
          to those terms, may not be copyrightable in some jurisdictions, and may resemble existing works. Review the model
          registry before commercial release of any generated asset.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Acceptable use</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          No unlawful content, no non-consensual likenesses, no content that sexualises minors, no attempts to bypass safety
          filters or to use the platform to train competing models. Render and generation quotas apply per plan and are shown in
          usage.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Availability and liability</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          The service is provided as-is during this preview period, without uptime commitments. Render jobs are best-effort and
          may be retried. Liability is limited to fees paid in the preceding three months.
        </p>
      </section>
    </MarketingShell>
  );
}
