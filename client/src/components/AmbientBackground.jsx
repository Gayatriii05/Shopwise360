export default function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div className="absolute -top-[18%] -left-[10%] h-[52vw] w-[52vw] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.20),transparent_65%)] blur-[40px] animate-drift" />
      <div className="absolute -top-[10%] right-[-12%] h-[46vw] w-[46vw] rounded-full bg-[radial-gradient(circle,rgba(236,72,153,0.14),transparent_65%)] blur-[40px] animate-drift-slow" />
      <div className="absolute bottom-[-22%] left-[22%] h-[48vw] w-[48vw] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.12),transparent_65%)] blur-[50px] animate-drift" style={{ animationDelay: '-8s' }} />

      <div className="absolute inset-0 bg-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_78%)] animate-grid-pan" />

      <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent" />

      <div className="absolute inset-0 bg-grain opacity-60 mix-blend-soft-light" />
    </div>
  );
}
