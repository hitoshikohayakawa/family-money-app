"use client";

import Link from "next/link";

type LegalLinksProps = {
  linkClassName?: string;
};

export function LegalLinks({ linkClassName = "" }: LegalLinksProps) {
  return (
    <>
      <Link
        href="/terms"
        className={linkClassName}
      >
        利用規約
      </Link>
      {" 及び "}
      <Link
        href="/privacy"
        className={linkClassName}
      >
        プライバシーポリシー
      </Link>
    </>
  );
}

type LegalLoginNoticeProps = {
  className?: string;
  linkClassName?: string;
};

export function LegalLoginNotice({
  className = "",
  linkClassName = "",
}: LegalLoginNoticeProps) {
  return (
    <p className={className}>
      <LegalLinks linkClassName={linkClassName} />
      {" に同意の上ログインしてください。"}
    </p>
  );
}
