import { Monogram } from "./monogram";

type CandidateAvatarProps = {
  name: string;
  photo: string | null;
  size?: "small" | "large";
};

/** The candidate's photo in the theme's avatar shape; initials when there's no photo. */
export const CandidateAvatar = ({ name, photo, size }: CandidateAvatarProps) => (
  <span className={`avatar ${photo ? "avatar--has-photo" : ""}`}>
    {photo && (
      // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing for next/image to optimise
      <img src={photo} alt={name} className={`monogram ${size ? `monogram--${size}` : ""} avatar__photo`} />
    )}
    <Monogram name={name} size={size} />
  </span>
);
