## Objective
Transform the current ProductPraat.nl codebase into a reusable "WritgoCMS" system that can be easily deployed for multiple client websites with minimal configuration changes.

## 1. Site Configuration System

Create a centralized configuration file that allows easy customization per site.

**Tasks:**
- Create `site.config.json` in root with site settings, branding, contact info, CMS config, SEO, and analytics
- Create `src/config/siteConfig.ts` with TypeScript interfaces to load the JSON config
- Export typed config for use throughout the application

## 2. Setup Automation Script

**Tasks:**
- Create `scripts/setup-new-site.js` - Interactive CLI tool with prompts for site name, tagline, URL, email, and template choice
- Script should generate `site.config.json` automatically
- Update `package.json` to add `"setup": "node scripts/setup-new-site.js"` script

## 3. Client Documentation

**Create `docs/SETUP.md`** covering:
- Prerequisites (Node.js, Supabase, Anthropic API)
- Quick start guide (5 minutes)
- Clone and install steps
- Environment configuration
- Database initialization
- Customization options (logo, colors, features)
- Deployment to Render/Vercel
- Client handoff checklist
- Troubleshooting common issues

**Create `docs/CLIENT_GUIDE.md`** for end clients:
- Accessing admin panel
- Dashboard overview
- Adding products (Shop template)
- Creating blog posts
- Editing pages
- Managing media/images
- SEO best practices
- Common tasks
- Troubleshooting

## 4. White-Label Improvements

**Tasks:**
- Update admin panel components to use `siteConfig` instead of hardcoded "ProductPraat"
- Update page titles and meta descriptions dynamically
- Update header, footer, and navigation with config values
- Create `src/hooks/useSiteConfig.ts` React hook for easy access
- Update `index.html` to use site config values

## 5. Additional Improvements

**Tasks:**
- Update `.env.example` with detailed comments explaining where to get each credential
- Create `.env.template` as a copy for client deployments
- Update main `README.md` with "Using WritgoCMS for Multiple Sites" section
- Add links to SETUP.md and CLIENT_GUIDE.md in README
- Update installation instructions to mention `npm run setup`

## Success Criteria

- [ ] `site.config.json` is created and properly structured
- [ ] `src/config/siteConfig.ts` loads config with TypeScript types
- [ ] Setup script (`npm run setup`) runs successfully
- [ ] `docs/SETUP.md` provides clear deployment instructions
- [ ] `docs/CLIENT_GUIDE.md` helps clients manage content
- [ ] Admin panel displays site name from config (not "ProductPraat")
- [ ] `.env.example` has clear comments for all variables
- [ ] `package.json` includes the new `setup` script
- [ ] Code compiles without TypeScript errors
- [ ] All existing functionality remains working

## Testing Steps

1. Run `npm run setup` and complete the prompts
2. Verify `site.config.json` is created correctly
3. Run `npm run dev` and see the configured site name in admin
4. Check that custom site name appears throughout the UI
5. Confirm all existing features (AI products, blog, etc.) still work

This will make WritgoCMS easily deployable for your own websites and client projects! 🚀
