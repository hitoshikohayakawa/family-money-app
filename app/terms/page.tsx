import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "利用規約 | ミラマネ",
  description: "ミラマネの利用規約です。",
};

const lastUpdated = "2026年5月29日";

function ArticleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[rgba(55,140,65,0.12)] bg-white px-6 py-6 shadow-[0_18px_40px_rgba(75,175,87,0.08)] sm:px-8">
      <h2 className="text-xl font-extrabold text-[#1F2D20]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-8 text-[#516251] sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F4FAF5_0%,#FFFFFF_18%,#FFFFFF_100%)] px-5 py-12 text-[#1F2D20] sm:px-8 lg:px-10 lg:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/login"
          className="inline-flex items-center rounded-full border border-[rgba(55,140,65,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[#378C41] transition hover:bg-[#F4FAF5]"
        >
          ログイン画面へ戻る
        </Link>

        <div className="mt-6 rounded-[36px] border border-[rgba(75,175,87,0.14)] bg-white px-6 py-8 shadow-[0_28px_60px_rgba(75,175,87,0.10)] sm:px-10 sm:py-10">
          <p className="text-sm font-extrabold tracking-[0.16em] text-[#4BAF57]">
            TERMS OF SERVICE
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#1F2D20] sm:text-4xl">
            利用規約
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#516251] sm:text-base">
            最終更新日：{lastUpdated}
          </p>
          <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
            本利用規約（以下「本規約」）は、ミラマネ（以下「本サービス」）の利用条件を定めるものです。利用者は本規約に同意の上、本サービスを利用するものとします。
          </p>
        </div>

        <div className="mt-8 grid gap-5">
          <ArticleSection title="第1条（本サービスについて）">
            <p>
              本サービスは、親子間でお金や投資について学ぶことを目的とした教育・シミュレーションサービスです。
            </p>
            <p>
              本サービス内で表示される投資成績、資産額、評価額その他の数値はすべてシミュレーション結果であり、実際の金融取引、投資成果、資産価値を表すものではありません。
            </p>
            <p>
              本サービスは金融商品取引サービスではなく、金融商品の売買、仲介、運用、投資助言その他の金融サービスを提供するものではありません。
            </p>
          </ArticleSection>

          <ArticleSection title="第2条（お小遣い申請について）">
            <p>利用者は本サービス上でお小遣い申請機能を利用できます。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>本サービスは親による金銭支払いを保証するものではありません</li>
              <li>親は申請内容を参考に独自の判断で支払い可否および支払金額を決定するものとします</li>
              <li>本サービスは支払い義務を発生させるものではありません</li>
            </ul>
            <p>
              申請額と実際に支払われる金額が異なる場合であっても、本サービスは一切責任を負いません。
            </p>
          </ArticleSection>

          <ArticleSection title="第3条（投資シミュレーションの価格算出）">
            <p>
              本サービスで表示される投資対象の価格、評価額および損益は、システム上取得可能な市場データをもとに算出されます。
            </p>
            <p>
              評価額の算出にあたっては、原則として前営業日の終値またはそれに準ずる価格を利用します。
            </p>
            <p>
              市場データの遅延、取得不能、計算誤差その他の理由により実際の市場価格との差異が発生する場合があります。
            </p>
            <p>
              利用者は当該数値が参考情報であることを理解した上で利用するものとします。
            </p>
          </ArticleSection>

          <ArticleSection title="第4条（データ保存とバックアップ）">
            <p>本サービスは継続的なデータ保存に努めますが、以下を保証するものではありません。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>データの完全性</li>
              <li>データの永続性</li>
              <li>データの復旧</li>
            </ul>
            <p>
              システム障害、サーバ障害、クラウド障害、プログラム不具合、第三者による攻撃その他の理由により、投資履歴、お小遣い履歴、累積実績、各種設定情報が消失する可能性があります。
            </p>
            <p>
              利用者は必要に応じてスクリーンショット、エクスポート機能その他の方法により定期的にバックアップを行うものとします。
            </p>
            <p>当社はデータ消失により生じた損害について責任を負いません。</p>
          </ArticleSection>

          <ArticleSection title="第5条（免責事項）">
            <p>本サービスは現状有姿（AS IS）で提供されます。</p>
            <p>当社は以下を保証しません。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>本サービスの完全性</li>
              <li>正確性</li>
              <li>継続性</li>
              <li>特定目的への適合性</li>
            </ul>
            <p>利用者が本サービスを利用した結果として生じた損害について、当社は責任を負いません。</p>
          </ArticleSection>

          <ArticleSection title="第6条（禁止事項）">
            <p>利用者は以下の行為を行ってはなりません。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>法令または公序良俗に反する行為</li>
              <li>不正アクセス</li>
              <li>システムへの過度な負荷行為</li>
              <li>データ改ざん</li>
              <li>第三者になりすます行為</li>
              <li>その他当社が不適切と判断する行為</li>
            </ul>
          </ArticleSection>

          <ArticleSection title="第7条（サービス変更・終了）">
            <p>
              当社は利用者への事前通知なく本サービスの内容変更、停止または終了を行うことができます。
            </p>
          </ArticleSection>

          <ArticleSection title="第8条（準拠法・管轄）">
            <p>本規約は日本法に準拠します。</p>
            <p>
              本サービスに関する紛争については、当社所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </ArticleSection>
        </div>
      </div>
    </main>
  );
}
