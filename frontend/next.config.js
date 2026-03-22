const withPWA = require('@ducanh2912/next-pwa').default({
	dest: 'public',
	disable: process.env.NODE_ENV === 'development',
	register: true,
	skipWaiting: true,
	cacheOnFrontEndNav: true,
	aggressiveFrontEndNavCaching: false,
	reloadOnOnline: true,
	swcMinify: true,
	workboxOptions: {
		disableDevLogs: true,
	}
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: false,
	// Allow ngrok and other external domains
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'Access-Control-Allow-Origin',
						value: '*',
					},
					{
						key: 'Access-Control-Allow-Methods',
						value: 'GET, POST, PUT, DELETE, OPTIONS',
					},
					{
						key: 'Access-Control-Allow-Headers',
						value: 'X-Requested-With, Content-Type, Authorization',
					},
				],
			},
		];
	},
};

module.exports = withPWA(nextConfig);
