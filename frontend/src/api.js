// Set VITE_API_BASE_URL in Netlify to the public Render service URL.
// The local fallback keeps `npm run dev` usable without a .env file.
const configuredApiUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5001";

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, "");
