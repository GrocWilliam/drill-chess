.PHONY: test build check

test:
	npm ci
	npx vitest run

build:
	npm ci
	npm run build

check:
	npm run check
