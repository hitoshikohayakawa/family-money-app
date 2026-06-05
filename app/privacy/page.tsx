import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "プライバシーポリシー | ミラマネ",
  description: "ミラマネのプライバシーポリシーです。",
};

const lastUpdated = "2026年5月29日";

function PolicySection({
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

export default function PrivacyPage() {
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
            PRIVACY POLICY
          </p>
          <h1 className="mt-3 text-3xl font-black text-[#1F2D20] sm:text-4xl">
            プライバシーポリシー
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#516251] sm:text-base">
            最終更新日：{lastUpdated}
          </p>
          <p className="mt-4 text-sm leading-8 text-[#516251] sm:text-base">
            ミラマネ（以下「当社」）は、本サービスにおける利用者の個人情報を以下のとおり取り扱います。
          </p>
        </div>

        <div className="mt-8 grid gap-5">
          <PolicySection title="1. 取得する情報">
            <p>当社は以下の情報を取得する場合があります。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>氏名またはニックネーム</li>
              <li>メールアドレス</li>
              <li>ログイン情報</li>
              <li>利用履歴</li>
              <li>投資シミュレーション履歴</li>
              <li>お小遣い申請履歴</li>
              <li>端末情報</li>
              <li>Cookie</li>
              <li>アクセスログ</li>
            </ul>
          </PolicySection>

          <PolicySection title="2. 利用目的">
            <p>取得した情報は以下の目的で利用します。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>サービス提供</li>
              <li>本人確認</li>
              <li>不具合対応</li>
              <li>サービス改善</li>
              <li>利用状況分析</li>
              <li>不正利用防止</li>
              <li>お問い合わせ対応</li>
            </ul>
          </PolicySection>

          <PolicySection title="3. 金融サービスではないこと">
            <p>本サービスは金融商品取引サービスではありません。</p>
            <p>
              本サービス内で入力された投資情報、投資履歴、評価額等は教育およびシミュレーション目的でのみ利用されます。
            </p>
          </PolicySection>

          <PolicySection title="4. 第三者提供">
            <p>
              当社は法令に基づく場合を除き、利用者の個人情報を本人の同意なく第三者へ提供しません。
            </p>
          </PolicySection>

          <PolicySection title="5. アクセス解析">
            <p>
              本サービスではサービス改善のためGoogle Analyticsその他のアクセス解析ツールを利用する場合があります。
            </p>
            <p>これらのツールはCookieを利用することがあります。</p>
          </PolicySection>

          <PolicySection title="6. データ保存について">
            <p>当社は利用者データの安全管理に努めますが、</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>システム障害</li>
              <li>通信障害</li>
              <li>クラウドサービス障害</li>
              <li>サイバー攻撃</li>
            </ul>
            <p>等によるデータ消失リスクを完全に防止することはできません。</p>
            <p>利用者は必要に応じて定期的なバックアップを行うものとします。</p>
          </PolicySection>

          <PolicySection title="7. 個人情報の開示等">
            <p>
              利用者は法令の定めに従い、自己の個人情報について開示、訂正、削除等を請求できます。
            </p>
          </PolicySection>

          <PolicySection title="8. お問い合わせ">
            <p>お問い合わせ先：</p>
            <p>メールアドレス：h.kohayakawa@petsallright.net</p>
            <p>運営者：ミラマネ運営</p>
          </PolicySection>
        </div>
      </div>
    </main>
  );
}
