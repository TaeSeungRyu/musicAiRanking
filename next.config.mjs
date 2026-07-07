/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3는 네이티브 모듈이므로 번들링에서 제외 (서버에서 직접 require)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
