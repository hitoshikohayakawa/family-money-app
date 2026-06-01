"use client";

import { Suspense } from "react";
import AllowanceGrantsPanel from "@/app/components/allowance-grants-panel";
import PageContainer from "@/app/components/ui/page-container";
import useElementaryMode from "@/app/components/use-elementary-mode";

export default function AllowanceHistoryContent() {
  const { elementaryMode } = useElementaryMode();

  return (
    <PageContainer
      title={elementaryMode ? "これまでの うけとりきろく" : "過去の受け取り履歴"}
      description={
        elementaryMode
          ? "これまでに しんせいしたものや、うけとった おこづかいを たしかめられます。"
          : "これまでに申請したものや、受け取り済みになったお小遣いを確認できます。"
      }
    >
      <Suspense>
        <AllowanceGrantsPanel viewMode="history" />
      </Suspense>
    </PageContainer>
  );
}
