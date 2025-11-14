import { useState } from "react";

export default function ApiKeyForm({ onConnect }) {
  const [agent, setAgent] = useState("");
  const [recallKey, setRecallKey] = useState("");
  const [env, setEnv] = useState("sandbox");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!agent.trim()) {
      setError("Agent name is required.");
      return;
    }
    if (!recallKey.trim()) {
      setError("Recall API key is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      // NOTE:
      // onConnect bisa kamu definisikan sebagai:
      // async function onConnect(agentName, recallApiKey, env) { ... }
      await onConnect(agent.trim(), recallKey.trim(), env);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="group relative mx-auto w-full max-w-md px-4 sm:px-0">
      {/* Animated glow background */}
      <div className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500/40 via-yellow-400/40 to-red-500/40 opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-75" />
      <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-orange-500/20 via-yellow-400/20 to-red-500/20 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full space-y-4 rounded-2xl border border-neutral-800/60 bg-black/95 px-5 py-6 shadow-[0_20px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-300 group-hover:border-neutral-700/80 group-hover:shadow-[0_24px_90px_rgba(0,0,0,0.95)] sm:space-y-5 sm:px-7 sm:py-7"
      >
        {/* Subtle top border accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />

        {/* Agent Name */}
        <div className="space-y-2 pt-2">
          <label
            htmlFor="agent-name"
            className="block text-xs font-semibold tracking-wide text-neutral-300"
          >
            Agent Name
          </label>
          <input
            id="agent-name"
            type="text"
            placeholder="Your agent name..."
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-neutral-700/70 bg-neutral-900/70 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
          />
        </div>

        {/* Recall API Key */}
        <div className="space-y-2">
          <label
            htmlFor="recall-api-key"
            className="block text-xs font-semibold tracking-wide text-neutral-300"
          >
            Recall API Key
          </label>
          <input
            id="recall-api-key"
            type="password"
            placeholder="Recall Agent API Key..."
            value={recallKey}
            onChange={(e) => setRecallKey(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-neutral-700/70 bg-neutral-900/70 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
          />
          <p className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Keep this key private.
          </p>
        </div>

        {/* Environment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="environment"
              className="block text-xs font-semibold tracking-wide text-neutral-300"
            >
              Environment
            </label>
            <span className="rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
              {env === "sandbox" ? "Sandbox" : "Production"}
            </span>
          </div>

          <select
            id="environment"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-lg border border-neutral-700/70 bg-neutral-900/70 px-3 py-2.5 text-sm text-neutral-100 outline-none transition-all duration-200 focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5"
          >
            <option value="sandbox">Sandbox</option>
            {/* kalau memang nilai untuk kompetisi adalah "competitions",
                biarkan seperti ini */}
            <option value="competitions">Production</option>
          </select>
        </div>

        {/* Error message (jika ada) */}
        {error && (
          <p className="text-xs font-medium text-red-400">{error}</p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="group/btn relative mt-3 w-full overflow-hidden rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-[0_10px_40px_rgba(56,189,248,0.4)] transition-all duration-300 hover:shadow-[0_14px_50px_rgba(56,189,248,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:mt-4 sm:py-3.5"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Connecting...
              </>
            ) : (
              <>
                Enter Dashboard
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  );
}
