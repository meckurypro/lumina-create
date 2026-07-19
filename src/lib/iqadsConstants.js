// src/lib/iqadsConstants.js
//
// Single source of truth for the resolution tiers IQ Ads supports.
// Both the admin cost-entry UI (IQAdsManager.jsx) and the pricing
// calculator (iqads.js) import this instead of each hardcoding their
// own '480p' / '720p' strings — that drift is what caused the pricing
// bug where the admin panel wrote to a different shape than the
// calculator read from.
export const IQADS_RESOLUTIONS = ['480p', '720p']
