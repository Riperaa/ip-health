"use client";

import { Check, Copy, Share2 } from "lucide-react";
import {
  FaFacebookF,
  FaTelegram,
  FaWeibo,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";
import { useState } from "react";

import { messages, type Locale } from "@/lib/localization";

type ShareStatus = "idle" | "copied" | "shared" | "error";

const iconClassName =
  "inline-flex size-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-white/50 hover:text-neutral-950 focus-visible:bg-white/60 focus-visible:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700";

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
      label: t("Share on X"),
      href: `https://twitter.com/intent/tweet?text=${encodedTextWithUrl}`,
      icon: FaXTwitter,
    },
    {
      label: t("Share on Facebook"),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: FaFacebookF,
    },
    {
      label: t("Share on Telegram"),
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      icon: FaTelegram,
    },
    {
      label: t("Share on WhatsApp"),
      href: `https://wa.me/?text=${encodedTextWithUrl}`,
      icon: FaWhatsapp,
    },
    {
      label: t("Share on Weibo"),
      href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedText}`,
      icon: FaWeibo,
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
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 z-30 sm:left-6">
      {statusMessage ? (
        <div className="surface-card absolute bottom-full left-0 mb-2 min-w-52 rounded-xl border bg-white px-3 py-2 text-left">
          <p aria-live="polite" className="text-xs text-neutral-600">
            {statusMessage}
          </p>
          {status === "error" ? (
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label={t("Share link")}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 h-8 w-full rounded-full border border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-700 outline-none focus:border-neutral-400"
            />
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label={t("Share IP Health")}
        className="flex items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100"
      >
        <button
          type="button"
          onClick={handleShare}
          aria-label={t("Share")}
          title={t("Share")}
          className={iconClassName}
        >
          <Share2 aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("Copy link")}
          title={t("Copy link")}
          className={iconClassName}
        >
          {status === "copied" ? (
            <Check aria-hidden="true" size={18} />
          ) : (
            <Copy aria-hidden="true" size={18} />
          )}
        </button>
        {platforms.map((platform) => {
          const Icon = platform.icon;

          return (
            <a
              key={platform.label}
              href={platform.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={platform.label}
              title={platform.label}
              className={iconClassName}
            >
              <Icon aria-hidden="true" size={18} />
            </a>
          );
        })}
      </nav>
    </div>
  );
}
