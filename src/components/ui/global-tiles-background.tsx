export function GlobalTilesBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Layer 1: repeating subtle grid that scales with full page height */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_right,rgba(100,116,139,0.17)_0,rgba(100,116,139,0.17)_1px,transparent_1px,transparent_68px),repeating-linear-gradient(to_bottom,rgba(100,116,139,0.17)_0,rgba(100,116,139,0.17)_1px,transparent_1px,transparent_68px)]" />

      {/* Layer 2: soft depth tint for premium SaaS look */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_5%,rgba(16,185,129,0.06),transparent_38%),radial-gradient(circle_at_95%_25%,rgba(59,130,246,0.05),transparent_42%)]" />

      {/* Bottom fade into page background to avoid harsh cutoff */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-b from-transparent via-white/78 to-white" />
    </div>
  );
}
