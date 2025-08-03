/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // necessário se você estiver usando <Image>
},
  basePath: '/teste-next', // <-- muito importante
  trailingSlash: true,     // melhora a compatibilidade com GH Pages
};

module.exports = nextConfig;
