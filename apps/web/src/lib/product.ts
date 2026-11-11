/** Branding is configuration, not code: rename the product from env. */
export const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME || "AI 3D Studio";
export const productTagline = process.env.NEXT_PUBLIC_PRODUCT_TAGLINE || "Describe a scene. Direct it like a film.";
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
export const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
export const isApiConfigured = apiBaseUrl.length > 0;
export const gpuJobsEnabled = process.env.NEXT_PUBLIC_ENABLE_GPU_JOBS === "true";
export const segmentationEnabled = process.env.NEXT_PUBLIC_ENABLE_SEGMENTATION === "true";
