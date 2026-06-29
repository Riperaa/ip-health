import { IpAnalyzer } from "@/components/ip-analyzer";

export default function Home() {
  return (
    <main className="min-h-dvh bg-white text-neutral-950">
      <a
        href="#sponsor"
        className="fixed right-4 top-4 z-10 rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] backdrop-blur transition hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:right-8 sm:top-7"
      >
        Sponsor
      </a>

      <section className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center justify-center px-5 py-24 sm:px-8">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-normal text-neutral-950 sm:text-6xl md:text-7xl">
            IP Health
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-7 text-neutral-500 sm:text-lg">
            Know whether you can trust this IP in 5 seconds.
          </p>

          <IpAnalyzer />
        </div>
      </section>

      <footer className="fixed inset-x-0 bottom-5 text-center text-sm text-neutral-400">
        Made with ❤️
      </footer>
    </main>
  );
}
