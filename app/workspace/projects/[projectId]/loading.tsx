export default function ProjectLoading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#171717] px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-[1600px] min-w-0">
        <header className="border-b border-white/10 pb-6">
          <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="h-4 w-24 animate-pulse rounded bg-teal-200/15" />
              <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-white/8" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-10 w-24 animate-pulse rounded-md bg-white/10" />
              <div className="h-10 w-28 animate-pulse rounded-md bg-white/10" />
            </div>
          </div>
        </header>

        <div className="mt-8 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="h-[620px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]" />
          <div className="h-[620px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]" />
        </div>
        <div className="mt-6 h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.05]" />
      </div>
    </main>
  );
}
