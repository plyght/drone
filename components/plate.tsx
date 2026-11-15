import { asset } from "@/lib/asset";

/**
 * A studio render with its caption under it. The plate is a photograph of a
 * dark studio, so it stays dark in both themes. `name` is the file under
 * /img/close, exported at 960 and 1600 wide.
 */
export function Plate({
  name,
  alt,
  title,
  line,
  sizes,
  className,
  ratio = "aspect-[16/10]",
}: {
  name: string;
  alt: string;
  title: string;
  line: string;
  sizes: string;
  className?: string;
  ratio?: string;
}) {
  return (
    <figure className={`plate m-0 ${className ?? ""}`}>
      <div className={`overflow-hidden rounded-[var(--radius-plate)] bg-plate ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static plate */}
        <img
          src={asset(`/img/close/${name}-1600.webp`)}
          srcSet={`${asset(`/img/close/${name}-960.webp`)} 960w, ${asset(`/img/close/${name}-1600.webp`)} 1600w`}
          sizes={sizes}
          alt={alt}
          width={1600}
          height={1000}
          loading="lazy"
          decoding="async"
          className="plate-img h-full w-full object-cover"
        />
      </div>
      <figcaption className="pt-3.5">
        <span className="block font-semibold tracking-[-0.02em]">{title}</span>
        <span className="mt-0.5 block max-w-[30em] text-muted">{line}</span>
      </figcaption>
    </figure>
  );
}
