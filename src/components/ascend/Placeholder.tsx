export default function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card-elegant p-10 md:p-16 text-center">
      <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Soon</p>
      <h2 className="font-serif text-3xl md:text-4xl text-primary mt-3">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground max-w-md mx-auto">{subtitle}</p>}
    </div>
  );
}
