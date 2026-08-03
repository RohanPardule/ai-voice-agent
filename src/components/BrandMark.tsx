export function BrandMark({
  size = "md",
  light = false,
}: {
  size?: "sm" | "md" | "lg";
  light?: boolean;
}) {
  const title =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  const subtitle = size === "lg" ? "text-xs" : "text-[10px]";

  return (
    <div className={`flex flex-col leading-none ${light ? "text-white" : "text-foreground"}`}>
      <span className={`${title} font-semibold tracking-[0.12em]`}>RADISSON</span>
      <span
        className={`${subtitle} mt-1 font-medium uppercase tracking-[0.28em] ${
          light ? "text-orange-300" : "text-primary"
        }`}
      >
        Hotel Goa
      </span>
    </div>
  );
}

export function BrandIcon({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-12 w-12 text-lg";
  return (
    <div
      className={`inline-flex items-center justify-center rounded-2xl bg-primary font-semibold tracking-wide text-primary-foreground ${dim}`}
    >
      R
    </div>
  );
}
