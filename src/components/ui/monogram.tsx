type MonogramProps = {
  name: string;
  size?: "small" | "large";
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const Monogram = ({ name, size }: MonogramProps) => (
  <span className={`monogram ${size ? `monogram--${size}` : ""}`} aria-hidden="true">
    {initialsOf(name)}
  </span>
);
