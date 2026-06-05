import Image from "next/image";

export default function NewsPageHeader() {
  return (
    <div className="overflow-hidden rounded-[20px] shadow-[0_8px_32px_rgba(76,163,104,0.14)]">
      <Image
        src="/images/miramane-news-header.png"
        alt="ミラマネニュース"
        width={1468}
        height={234}
        className="h-auto w-full"
        priority
      />
    </div>
  );
}
