export default function YieldLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <div className="h-3 w-40 animate-pulse bg-white/10" />
        <div className="mt-3 h-12 w-72 animate-pulse bg-white/10 md:w-96" />
        <div className="mt-4 h-4 w-full max-w-3xl animate-pulse bg-white/10" />
      </div>
      <section className="mt-8 grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/10 p-4">
            <div className="h-3 w-24 animate-pulse bg-white/10" />
            <div className="mt-3 h-7 w-28 animate-pulse bg-white/10" />
          </div>
        ))}
      </section>
    </main>
  );
}
