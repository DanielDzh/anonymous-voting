import { PHOTO_JPEG_QUALITY, PHOTO_SIZE_PX } from "@/config/voting";

/**
 * Browser-side: centre-crops an image file to a square and re-encodes it as a small JPEG
 * data URL, so a multi-megabyte phone photo never leaves the admin's device at full size.
 */
export const fileToSquareJpeg = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sourceX = (bitmap.width - side) / 2;
  const sourceY = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE_PX;
  canvas.height = PHOTO_SIZE_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");

  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, PHOTO_SIZE_PX, PHOTO_SIZE_PX);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
};
