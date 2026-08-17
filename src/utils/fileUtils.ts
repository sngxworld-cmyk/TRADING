/**
 * Utility functions for local image processing and downloading
 */

/**
 * Trigger browser download for any image data URL or blob URL to user's local disk
 */
export function downloadImageToLocal(imageUrl: string, suggestedFilename?: string) {
  if (!imageUrl) return;
  try {
    const link = document.createElement("a");
    link.href = imageUrl;
    const cleanName = suggestedFilename
      ? suggestedFilename.replace(/[^a-zA-Z0-9._-]/g, "_")
      : `trading_photo_${Date.now()}.png`;
    link.download = cleanName.endsWith(".png") || cleanName.endsWith(".jpg") || cleanName.endsWith(".jpeg")
      ? cleanName
      : `${cleanName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Failed to download image:", err);
    // Fallback: open in new tab if direct download blocked
    window.open(imageUrl, "_blank");
  }
}

/**
 * Read local File object as compressed/clean Base64 Data URL
 */
export function readLocalImageFile(file: File, maxSizeMB = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file provided"));
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`File size must be under ${maxSizeMB}MB`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to parse file as image string"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
