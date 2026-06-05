"use client";

import { Suspense } from "react";
import AllowanceGrantsPanel from "@/app/components/allowance-grants-panel";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import PageContainer from "@/app/components/ui/page-container";
import useElementaryMode from "@/app/components/use-elementary-mode";

export default function AllowanceHistoryContent() {
  const { elementaryMode } = useElementaryMode();

  return (
    <PageContainer
      title={<AutoHiragana enabled={elementaryMode}>過去の受け取り履歴</AutoHiragana>}
      description={<AutoHiragana enabled={elementaryMode}>これまでに申請したものや、受け取り済みになったお小遣いを確認できます。</AutoHiragana>}
    >
      <Suspense>
        <AllowanceGrantsPanel viewMode="history" />
      </Suspense>
    </PageContainer>
  );
}
