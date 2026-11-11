import { MarketingShell } from "@/components/marketing/MarketingShell";
import { supportEmail } from "@/lib/product";

const FAQ = [
  {
    q: "Is the demo scene real or a picture?",
    a: "Real geometry. The studio renders the scene document with Three.js, and the same document drives the Blender builder. Click any object in the viewport to see its properties.",
  },
  {
    q: "Why did my instruction produce no change?",
    a: 'The planner only acts when it can resolve a target and a property. Name the object ("the apple"), the property ("oak wood", "sunset light") and the verb ("make", "replace", "animate"). The plan panel lists every unresolved reference.',
  },
  {
    q: "Are AI edits permanent?",
    a: "No. Every applied plan creates a snapshot in history. Undo, jump to an earlier version, or branch a variation. Objects can be locked or protected to block edits entirely.",
  },
  {
    q: "Does it render video?",
    a: "Rendering is handled by the Blender worker service. Without a configured worker the studio shows render as unavailable rather than producing a fake file. Presets are 1080p and 1440p; 4K is gated behind a GPU worker flag.",
  },
  {
    q: "Which models are integrated?",
    a: "None by default. Adapter interfaces live in services/ai-orchestrator/adapters with a model registry recording licence, hardware and commercial-use status. Enable a provider only after reviewing its licence.",
  },
  {
    q: "Can I export a Blender project?",
    a: "Yes: the export endpoint runs the scene builder and returns an editable .blend, with objects named by id so round-tripping is possible.",
  },
];

export default function HelpPage() {
  return (
    <MarketingShell title="Help centre" lead="Short answers to the questions this build actually raises.">
      <div className="space-y-6">
        {FAQ.map((item) => (
          <details key={item.q} className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-neutral-100">{item.q}</summary>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">{item.a}</p>
          </details>
        ))}
        <div className="rounded-xl border border-studio-800 bg-studio-900/60 p-4 text-xs text-neutral-400">
          Still stuck? Write to <span className="text-neutral-200">{supportEmail}</span> with the project id and the prompt that
          failed. Prompts and plans are logged so an issue can be reproduced exactly.
        </div>
      </div>
    </MarketingShell>
  );
}
