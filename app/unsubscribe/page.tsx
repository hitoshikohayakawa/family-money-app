"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4FAF5] px-5 py-16">
      <div className="w-full max-w-md rounded-[32px] border border-[rgba(55,140,65,0.14)] bg-white p-8 shadow-[0_30px_70px_rgba(75,175,87,0.14)] text-center">
        {success ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F4FAF5] text-2xl">
              ✅
            </div>
            <h1 className="text-xl font-black text-[#1F2D20]">
              配信停止しました
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#516251]">
              アップデート情報メールの配信を停止しました。
            </p>
            <p className="mt-2 text-sm leading-7 text-[#516251]">
              ※ お小遣いの付与・支払い通知など、サービス利用に必要なメールは引き続き届きます。
            </p>
          </>
        ) : error === "invalid" ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF2EE] text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-black text-[#1F2D20]">
              無効なリンクです
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#516251]">
              配信停止リンクが無効または期限切れです。
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF2EE] text-2xl">
              ❌
            </div>
            <h1 className="text-xl font-black text-[#1F2D20]">
              エラーが発生しました
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#516251]">
              配信停止の処理中にエラーが発生しました。しばらくしてから再度お試しください。
            </p>
          </>
        )}

        <div className="mt-8">
          <Link
            href="/"
            className="text-sm font-bold text-[#378C41] underline underline-offset-4"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F4FAF5]">
          <p className="text-sm text-[#516251]">処理中...</p>
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
