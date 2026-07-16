"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { messages, type Locale } from "@/lib/localization";

type ShareStatus = "idle" | "copied" | "shared" | "error";

const platformClassName =
  "inline-flex h-10 items-center justify-center rounded-full border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-600 shadow-sm shadow-neutral-950/[0.03] transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Clipboard access timed out.")),
            500,
          );
        }),
      ]);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API without granting access.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    throw new Error("Unable to copy link.");
  }
}

export function SocialShare({ locale = "en" }: { locale?: Locale }) {
  const t = messages(locale);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const shareUrl =
    locale === "zh" ? "https://iphealth.app/zh" : "https://iphealth.app";
  const shareTitle =
    locale === "zh"
      ? "IP Health – 检查 IP 声誉、网络身份和风险信号"
      : "IP Health – Check IP Trust, Risk, and Compatibility";
  const shareText =
    locale === "zh"
      ? "在注册、登录或支付前检查 IP 声誉、网络身份和风险信号。"
      : "Check IP reputation and risk signals before logging in.";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const encodedTextWithUrl = encodeURIComponent(`${shareText} ${shareUrl}`);
  const platforms = [
    {
      label: "X",
      ariaLabel: t("Share on X"),
      href: `https://twitter.com/intent/tweet?text=${encodedTextWithUrl}`,
    },
    {
      label: "Facebook",
      ariaLabel: t("Share on Facebook"),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "Telegram",
      ariaLabel: t("Share on Telegram"),
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      label: "WhatsApp",
      ariaLabel: t("Share on WhatsApp"),
      href: `https://wa.me/?text=${encodedTextWithUrl}`,
    },
    {
      label: t("Weibo"),
      ariaLabel: t("Share on Weibo"),
      href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedText}`,
    },
  ];

  async function handleCopy() {
    try {
      await copyText(shareUrl);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await handleCopy();
      return;
    }

    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      setStatus("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        return;
      }

      setStatus("error");
    }
  }

  const statusMessage =
    status === "copied"
      ? t("Link copied")
      : status === "shared"
        ? t("Shared")
        : status === "error"
          ? t("Automatic copy failed. Select the link below.")
          : "";

  return (
    <section
      aria-labelledby={`social-share-${locale}-heading`}
      className="surface-card-soft mt-6 rounded-[24px] border bg-white p-5 text-left"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id={`social-share-${locale}-heading`}
            className="text-sm font-semibold text-neutral-950"
          >
            {t("Share IP Health")}
          </h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            {t("Help others check IP reputation before logging in.")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm shadow-neutral-950/20 transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <Share2 aria-hidden="true" size={16} />
            {t("Share")}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={platformClassName}
          >
            {status === "copied" ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Copy aria-hidden="true" size={16} />
            )}
            <span className="ml-1.5">{t("Copy link")}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {platforms.map((platform) => (
          <a
            key={platform.label}
            href={platform.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={platform.ariaLabel}
            className={platformClassName}
          >
            {platform.label}
          </a>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-neutral-500">
        {statusMessage}
      </p>
      {status === "error" ? (
        <input
          type="text"
          readOnly
          value={shareUrl}
          aria-label={t("Share link")}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-2 h-10 w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-700 outline-none focus:border-neutral-400"
        />
      ) : null}
    </section>
  );
}
