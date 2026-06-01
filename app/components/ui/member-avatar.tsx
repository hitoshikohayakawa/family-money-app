"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  avatarPath: string | null | undefined;
  avatarEmoji: string | null | undefined;
  displayLabel: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 rounded-[12px] text-base",
  md: "h-12 w-12 rounded-[18px] text-lg",
  lg: "h-16 w-16 rounded-[22px] text-2xl",
};

export default function MemberAvatar({
  avatarPath,
  avatarEmoji,
  displayLabel,
  size = "md",
  className = "",
}: Props) {
  // { path, url } – only used when path matches current avatarPath
  const [loaded, setLoaded] = useState<{ path: string; url: string } | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!avatarPath) return;

    let cancelled = false;

    supabase.storage
      .from("family-member-avatars")
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) {
          setLoaded({ path: avatarPath, url: data.signedUrl });
          setImgError(false);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [avatarPath]);

  // Only use the signed URL when it corresponds to the current avatarPath
  const signedUrl = loaded !== null && loaded.path === avatarPath ? loaded.url : null;

  const baseClass = `flex shrink-0 items-center justify-center overflow-hidden ${sizeClasses[size]} ${className}`;

  if (avatarPath && signedUrl && !imgError) {
    return (
      <div className={baseClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={displayLabel}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  if (avatarEmoji) {
    return (
      <div className={`${baseClass} bg-[var(--surface-accent)]`}>
        {avatarEmoji}
      </div>
    );
  }

  return (
    <div className={`${baseClass} bg-[var(--surface-accent)] font-bold text-[var(--brand-primary-strong)]`}>
      {displayLabel.slice(0, 1)}
    </div>
  );
}
