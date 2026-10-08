type DisplayTitleProps = {
  text: string;
  className?: string;
};

export const DisplayTitle = ({ text, className = "" }: DisplayTitleProps) => (
  <h1 className={`display ${className}`}>{text}</h1>
);
