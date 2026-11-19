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
	NO_MKDOCS_2_WARNING=1 uvx --with mkdocs==1.6.1 --with mkdocs-material==9.8.1 --with mkdocs-mermaid-zoom==0.1.0 mkdocs serve --strict
