// @ts-check
const { defineConfig, devices } = require( '@playwright/test' );

// The extension's scripts are loaded into test pages with a fake extension API (see tests/helpers.js),
// so the same tests run in Chromium and Firefox. tests/extension.spec.js also loads the real extension in Chromium.
module.exports = defineConfig( {
	testDir: 'tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [ [ 'list' ], [ 'github' ] ] : 'list',
	use: { trace: 'retain-on-failure' },
	projects: [
		{ name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } },
		{ name: 'firefox', use: { ...devices[ 'Desktop Firefox' ] } },
	],
} );
