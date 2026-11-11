import { MarketingShell } from "@/components/marketing/MarketingShell";
import { productName, supportEmail } from "@/lib/product";

export default function PrivacyPage() {
  return (
    <MarketingShell title="Privacy policy" lead="Last updated 11 November 2026. Template text — have counsel review before launch.">
      <section>
        <h2 className="text-base font-semibold text-neutral-100">What we store</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Account data (email, display name), project content (scene documents, uploaded assets, render outputs), usage records
          (AI edits, render minutes, storage) and audit logs of edits. Scene documents and assets are stored in Postgres and
          object storage under your account, isolated by row-level security.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">What we do not do</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          We do not train models on your projects. Any future use of customer content for model improvement requires explicit,
          revocable, per-project consent recorded in the audit log. We do not sell project content. A model provider only
          receives a request when you enable that provider for a specific job, and the payload is limited to the prompt and the
          referenced assets.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Deletion</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Deleting a project soft-deletes it for 30 days, then removes scene documents, assets and derived renders. Audit records
          are retained for 12 months without content so billing and abuse investigations remain possible.
        </p>
      </section>
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Contact</h2>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">
          Data requests: {supportEmail}. {productName} is the provisional product name and may change; this policy follows the
          product.
        </p>
      </section>
    </MarketingShell>
  );
}
