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
	devIndicators: false,
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
					{
						key: 'X-DNS-Prefetch-Control',
						value: 'on',
					},
					{
						key: 'Permissions-Policy',
						value: 'camera=(), microphone=(), geolocation=()',
					},
				],
			},
		];
	},
};

module.exports = withPWA(nextConfig);
