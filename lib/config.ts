// Application configuration - all values can be overridden via environment variables

export const config = {
  // Geolocation settings
  geo: {
    maxAccuracyM: parseInt(process.env.MAX_ACCURACY_M || '150', 10),
    maxDistanceM: parseInt(process.env.MAX_DISTANCE_M || '200', 10),
  },

  // Rate limiting
  rateLimit: {
    freePostsPerLocationPerDay: parseInt(process.env.FREE_POSTS_PER_DAY || '3', 10),
    cooldownMs: parseInt(process.env.POST_COOLDOWN_MS || '120000', 10), // 2 minutes
  },

  // Moderation
  moderation: {
    flagThreshold: parseInt(process.env.FLAG_THRESHOLD || '5', 10),
  },

  // Payment settings (defaults set low for testing)
  payment: {
    postPriceSats: parseInt(process.env.POST_PRICE_SATS || '5', 10),
    boostPriceSats: parseInt(process.env.BOOST_PRICE_SATS || '5', 10),
    deletePriceSats: parseInt(process.env.DELETE_PRICE_SATS || '5', 10),
    sponsorPriceSats: parseInt(process.env.SPONSOR_PRICE_SATS || '5', 10),
    sponsorDurationDays: parseInt(process.env.SPONSOR_DURATION_DAYS || '30', 10),
    boostDurationHours: parseInt(process.env.BOOST_DURATION_HOURS || '24', 10),
    freeDeleteWindowMs: parseInt(process.env.FREE_DELETE_WINDOW_MS || '600000', 10), // 10 minutes
  },

  // DEV mode settings
  dev: {
    enabled: process.env.DEV_MODE === 'true',
    skipPayments: process.env.DEV_SKIP_PAYMENTS === 'true',
  },

  // Lightning provider settings
  lightning: {
    provider: process.env.LIGHTNING_PROVIDER || 'dev',
    // Use NEXT_PUBLIC_ prefix so frontend can check if test mode is available
    testModeEnabled:
      process.env.NEXT_PUBLIC_LIGHTNING_TEST_MODE === 'true' ||
      process.env.LIGHTSPARK_TEST_MODE === 'true' ||
      process.env.LIGHTNING_PROVIDER === 'dev' ||
      process.env.DEV_MODE === 'true',
  },

  // Pin settings
  pin: {
    maxBodyLength: 280,
    maxDoodleSize: parseInt(process.env.MAX_DOODLE_SIZE || '50000', 10), // ~50KB base64
  },
};
