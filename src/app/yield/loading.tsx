export default function YieldLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="border-b border-white/10 pb-7">
        <div className="h-3 w-40 animate-pulse bg-white/10" />
        <div className="mt-3 h-10 w-72 animate-pulse bg-white/10 md:h-14 md:w-96" />
        <div className="mt-4 h-4 w-full max-w-3xl animate-pulse bg-white/10" />
        <div className="mt-2 h-4 w-5/6 max-w-2xl animate-pulse bg-white/10" />
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-white/10 p-4">
            <div className="h-3 w-24 animate-pulse bg-white/10" />
            <div className="mt-3 h-7 w-28 animate-pulse bg-white/10" />
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="h-8 w-64 animate-pulse bg-white/10" />
          <div className="mt-4 border-t border-white/10">
            {Array.from({ length: 6 }).map((_, i) => (
              <article key={i} className="grid gap-4 border-b border-white/10 py-5 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <div className="mb-2 h-4 w-40 animate-pulse bg-white/10" />
                  <div className="h-4 w-11/12 animate-pulse bg-white/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse bg-white/10 md:ml-auto" />
                  <div className="h-3 w-24 animate-pulse bg-white/10 md:ml-auto" />
                  <div className="h-3 w-24 animate-pulse bg-white/10 md:ml-auto" />
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-white/10 p-5">
              <div className="h-5 w-40 animate-pulse bg-white/10" />
              <div className="mt-3 h-3 w-full animate-pulse bg-white/10" />
              <div className="mt-2 h-3 w-5/6 animate-pulse bg-white/10" />
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
