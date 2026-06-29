"use client";

import { FormEvent, useState } from "react";

export function IpAnalyzer() {
  const [ipAddress, setIpAddress] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-3"
    >
      <button
        type="button"
        className="h-12 rounded-full border border-neutral-200 bg-white px-6 text-sm font-medium text-neutral-700 shadow-sm shadow-neutral-950/[0.04] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        Auto Detect My IP
      </button>

      <div className="mt-3 flex w-full flex-col gap-3 rounded-[28px] border border-neutral-200 bg-white p-2 shadow-[0_12px_50px_rgba(0,0,0,0.08)] transition focus-within:border-neutral-300 sm:flex-row sm:items-center">
        <label htmlFor="ip-address" className="sr-only">
          IP address
        </label>
        <input
          id="ip-address"
          name="ip-address"
          type="text"
          inputMode="text"
          autoComplete="off"
          value={ipAddress}
          onChange={(event) => setIpAddress(event.target.value)}
          placeholder="Enter an IPv4 or IPv6 address"
          className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-base text-neutral-950 outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          Analyze
        </button>
      </div>
    </form>
  );
}
