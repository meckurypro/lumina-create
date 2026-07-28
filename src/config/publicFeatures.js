// src/config/publicFeatures.js
//
// Single source of truth for the 8 public /features/* SEO landing pages.
// Used by:
//   - LandingPage.jsx        (the "Features" grid section on the homepage)
//   - FeaturesFooter.jsx     (cross-links rendered at the bottom of every
//                             /features/* page, so the crawler can hop
//                             between them without going back through the
//                             homepage each time)
//
// Add a new feature page → add one entry here → both places update.
import {
  Wand2, VideoIcon, ImageIcon, User, Film, Users, Sparkles, Maximize2,
} from 'lucide-react'

export const PUBLIC_FEATURES = [
  {
    slug:  'iq-ads',
    label: 'IQ Ads',
    blurb: 'Turn any flyer into a video ad',
    icon:  Wand2,
  },
  {
    slug:  'video',
    label: 'Video Generator',
    blurb: 'Text or image to video',
    icon:  VideoIcon,
  },
  {
    slug:  'image',
    label: 'Image Generator',
    blurb: 'Text or reference to image',
    icon:  ImageIcon,
  },
  {
    slug:  'talking-head',
    label: 'Talking Head',
    blurb: 'Make any photo talk',
    icon:  User,
  },
  {
    slug:  'copy-motion',
    label: 'Copy Motion',
    blurb: 'Copy motion onto your photo',
    icon:  Film,
  },
  {
    slug:  'ugc',
    label: 'UGC & Brands',
    blurb: 'Reusable characters & brand content',
    icon:  Users,
  },
  {
    slug:  'photo-polish',
    label: 'Photo Polish',
    blurb: 'Cinematic photo enhancement',
    icon:  Sparkles,
  },
  {
    slug:  'upscaler',
    label: 'Upscaler',
    blurb: 'Sharpen any image or video',
    icon:  Maximize2,
  },
]

