"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  ANALYSIS_LOADING_STEPS,
  AnalysisLoading,
} from "@/components/analysis-loading";
import { DisclosureSection, IpAnalyzer } from "@/components/ip-analyzer";
import { ResultFeedback } from "@/components/result-feedback";
import {
  buildAnalysis,
  detectPublicIp as detectCurrentPublicIp,
  getEmptyAnalysisResult,
  loadRecentChecks,
  saveRecentCheck,
  type AnalysisResult,
  type AnalysisProgressEvent,
  type AnalysisProgressStepId,
  type RecentCheck,
} from "@/lib/analysis";
import {
  INVALID_IP_ADDRESS_MESSAGE,
  isValidIpv4Address,
} from "@/lib/analysis/validation";
import {
  getAnalysisContext,
  trackAnalyticsEvent,
} from "@/lib/analytics";
import { localizeText, type Locale } from "@/lib/localization";

const checkBeforeCards = [
  {
    title: "Account Registration",
    description: "Check whether your IP may trigger signup verification.",
  },
  {
    title: "VPN Usage",
    description: "Understand whether your VPN exit IP looks trustworthy.",
  },
  {
    title: "Online Security",
    description: "See how websites may evaluate your network identity.",
  },
];

const analysisLoadingStepIds = ANALYSIS_LOADING_STEPS.map((step) => step.id);

type AnalysisLoadingState = {
  completedSteps: AnalysisProgressStepId[];
  errorSteps: AnalysisProgressStepId[];
  isComplete: boolean;
};

const initialAnalysisLoadingState: AnalysisLoadingState = {
  completedSteps: [],
  errorSteps: [],
  isComplete: false,
};

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function addUniqueStep(
  steps: readonly AnalysisProgressStepId[],
  step: AnalysisProgressStepId,
) {
  return steps.includes(step) ? [...steps] : [...steps, step];
}

function LoadingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}

export function IpAnalyzerContainer({ locale = "en" }: { locale?: Locale }) {
  const t = useCallback(
    (value: string) => localizeText(locale, value),
    [locale],
  );
  const [isQaMode, setIsQaMode] = useState(false);
  const [ipAddress, setIpAddress] = useState("");
  const [error, setError] = useState("");
  const [analysisErrorIp, setAnalysisErrorIp] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(
    getEmptyAnalysisResult(),
  );
  const [recentChecks, setRecentChecks] = useState<RecentCheck[]>([]);
  const [isRecentChecksVisible, setIsRecentChecksVisible] = useState(false);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(true);
  const [analysisLoadingState, setAnalysisLoadingState] =
    useState<AnalysisLoadingState>(initialAnalysisLoadingState);
  const isAnalysisInFlight = useRef(false);
  const isQaModeRef = useRef(false);

  const analyzeAddress = useCallback(async (nextIpAddress: string) => {
    if (isAnalysisInFlight.current) {
      return;
    }

    const trimmedIpAddress = nextIpAddress.trim();

    if (!trimmedIpAddress) {
      setError(t(INVALID_IP_ADDRESS_MESSAGE));
      setAnalysisErrorIp("");
      setAnalysisResult(getEmptyAnalysisResult(trimmedIpAddress));
      setAnalysisStarted(false);
      return;
    }

    if (!isValidIpv4Address(trimmedIpAddress)) {
      setError(t(INVALID_IP_ADDRESS_MESSAGE));
      setAnalysisErrorIp("");
      setAnalysisResult(getEmptyAnalysisResult(trimmedIpAddress));
      setAnalysisStarted(false);
      return;
    }

    const isQaAnalysis = isQaModeRef.current;

    isAnalysisInFlight.current = true;
    setError("");
    setAnalysisErrorIp("");
    setAnalysisResult(getEmptyAnalysisResult(trimmedIpAddress));
    setAnalysisStarted(true);
    setIsAnalyzing(true);
    setAnalysisLoadingState(initialAnalysisLoadingState);
    trackAnalyticsEvent("analyze_started", {}, { qaMode: isQaAnalysis });

    function handleProgress(event: AnalysisProgressEvent) {
      setAnalysisLoadingState((currentState) => {
        if (event.status === "running") {
          return {
            ...currentState,
            isComplete: false,
          };
        }

        if (event.status === "completed") {
          return {
            completedSteps: addUniqueStep(
              currentState.completedSteps,
              event.step,
            ),
            errorSteps: currentState.errorSteps.filter(
              (step) => step !== event.step,
            ),
            isComplete: false,
          };
        }

        return {
          completedSteps: currentState.completedSteps.filter(
            (step) => step !== event.step,
          ),
          errorSteps: addUniqueStep(currentState.errorSteps, event.step),
          isComplete: false,
        };
      });
    }

    try {
      const nextAnalysisResult = await buildAnalysis(trimmedIpAddress, {
        onProgress: handleProgress,
        qaMode: isQaAnalysis,
      });

      setAnalysisResult(nextAnalysisResult);
      if (!isQaAnalysis) {
        setRecentChecks(saveRecentCheck(trimmedIpAddress));
      }
      setAnalysisLoadingState({
        completedSteps: analysisLoadingStepIds,
        errorSteps: [],
        isComplete: true,
      });
      trackAnalyticsEvent("analyze_completed", {
        ...getAnalysisContext(nextAnalysisResult),
        success: true,
      }, { qaMode: isQaAnalysis });
      await wait(500);
    } catch {
      setAnalysisResult(getEmptyAnalysisResult(trimmedIpAddress));
      setAnalysisErrorIp(trimmedIpAddress);
      trackAnalyticsEvent("analyze_completed", {
        ...getAnalysisContext(null),
        success: false,
      }, { qaMode: isQaAnalysis });
    } finally {
      isAnalysisInFlight.current = false;
      setIsAnalyzing(false);
    }
  }, [t]);

  const handleDetectPublicIp = useCallback(async () => {
    setError("");
    setAnalysisErrorIp("");
    setAnalysisStarted(false);
    setIsDetecting(true);

    try {
      const detectedIp = await detectCurrentPublicIp();
      setIpAddress(detectedIp);
      setAnalysisResult(getEmptyAnalysisResult(detectedIp));
    } catch {
      setError(t("Unable to detect your IP. You can enter it manually."));
    } finally {
      setIsDetecting(false);
    }
  }, [t]);

  useEffect(() => {
    void handleDetectPublicIp();
  }, [handleDetectPublicIp]);

  useEffect(() => {
    const qaMode =
      new URLSearchParams(window.location.search).get("qa") === "true";

    isQaModeRef.current = qaMode;
    setIsQaMode(qaMode);
  }, []);

  useEffect(() => {
    setRecentChecks(loadRecentChecks());
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void analyzeAddress(ipAddress);
  }

  function handleRecentCheckClick(nextIpAddress: string) {
    setIpAddress(nextIpAddress);
    void analyzeAddress(nextIpAddress);
  }

  function handleRetry() {
    void analyzeAddress(analysisErrorIp || ipAddress);
  }

  const isAnalysisLoadingVisible = analysisStarted && isAnalyzing;

  return (
    <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center gap-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col items-center gap-3"
      >
        {isQaMode ? (
          <p className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            {t("QA mode: checks are not saved.")}
          </p>
        ) : null}
        <div className="surface-card flex w-full flex-col gap-3 rounded-[28px] border bg-white p-2 transition focus-within:border-neutral-300 sm:flex-row sm:items-center">
          <label htmlFor="ip-address" className="sr-only">
            {t("IP address")}
          </label>
          <input
            id="ip-address"
            name="ip-address"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={ipAddress}
            onChange={(event) => setIpAddress(event.target.value)}
            placeholder={t("Enter an IPv4 address")}
            className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-base text-neutral-950 outline-none placeholder:text-neutral-400"
          />
          <button
            type="submit"
            disabled={isAnalyzing}
            className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            {isAnalyzing ? (
              <>
                <LoadingSpinner />
                <span>{t("Analyzing IP...")}</span>
              </>
            ) : (
              t("Analyze")
            )}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleDetectPublicIp}
            disabled={isDetecting}
            className="h-10 rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDetecting ? t("Detecting...") : t("Auto Detect My IP")}
          </button>
          <Link
            href="/compare"
            className="flex h-10 items-center rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            {t("Compare IPs")}
          </Link>
        </div>
      </form>

      {isAnalysisLoadingVisible ? (
        <AnalysisLoading
          completedSteps={analysisLoadingState.completedSteps}
          errorSteps={analysisLoadingState.errorSteps}
          isComplete={analysisLoadingState.isComplete}
          locale={locale}
        />
      ) : null}

      {analysisErrorIp ? (
        <div className="w-full rounded-2xl border border-red-100 bg-red-50 p-4 text-left">
          <p className="text-sm font-semibold text-red-700">{t("Analysis failed")}</p>
          <p className="mt-1 text-sm leading-6 text-red-600">
            {t("Unable to retrieve IP information.")}
            <br />
            {t("Please try again in a moment.")}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isAnalyzing}
            className="mt-3 h-10 rounded-full bg-red-700 px-5 text-sm font-semibold text-white shadow-sm shadow-red-950/10 transition hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t("Retry")}
          </button>
        </div>
      ) : error ? (
        <p className="text-sm font-medium text-neutral-500">{error}</p>
      ) : null}

      {!isAnalysisLoadingVisible && analysisStarted && !analysisErrorIp ? (
        <div className="w-full">
          <IpAnalyzer result={analysisResult} locale={locale} />
          {analysisResult.trustScore.hasAnalysis ? (
            <ResultFeedback
              context={getAnalysisContext(analysisResult)}
              isQaMode={isQaMode}
              locale={locale}
            />
          ) : null}
        </div>
      ) : null}

      {analysisStarted && !isAnalysisLoadingVisible ? (
        <div className="w-full text-left">
          <DisclosureSection
            title={t("Recent Checks")}
            summary={t("Saved in this browser only")}
            isExpanded={isRecentChecksVisible}
            onToggle={() =>
              setIsRecentChecksVisible(
                (currentVisibility) => !currentVisibility,
              )
            }
            contentId="recent-checks-content"
          >
            {recentChecks.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {recentChecks.map((recentCheck) => (
                  <button
                    key={recentCheck.ip}
                    type="button"
                    onClick={() => handleRecentCheckClick(recentCheck.ip)}
                    disabled={isAnalyzing}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.02] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {recentCheck.ip}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-400">
                {t("No recent checks yet.")}
              </p>
            )}
          </DisclosureSection>
        </div>
      ) : null}

      <section className="w-full text-left">
        <p className="text-sm font-semibold text-neutral-950">
          {t("Why check your IP?")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {checkBeforeCards.map((card) => (
            <div
              key={card.title}
              className="surface-card-soft rounded-2xl border bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-neutral-950">
                {t(card.title)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {t(card.description)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
