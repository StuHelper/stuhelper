.PHONY: setup setup-contracts check hooks docs
setup:
	LEFTHOOK=0 pnpm install --frozen-lockfile
setup-contracts:
	node scripts/workspace-install-oasdiff.mjs
check:
	pnpm exec stuhelper-check repository
	node scripts/architecture.mjs
	node scripts/docs.mjs
	node scripts/workspace.mjs validate
	node --test scripts/*.test.mjs
	pnpm run check:docs
	pnpm exec stuhelper-check workflows
hooks:
	pnpm exec lefthook install
docs:
	uvx --with mkdocs-material --with mkdocs-mermaid-zoom mkdocs serve
