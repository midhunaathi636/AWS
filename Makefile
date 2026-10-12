build-PlatformApiFunction:
	mkdir -p "$(ARTIFACTS_DIR)/aws"
	cp server.js aws-services.js postgres-compat.js postgres-worker.js report-pdf.js package.json package-lock.json "$(ARTIFACTS_DIR)/"
	cp aws/lambda-handler.js "$(ARTIFACTS_DIR)/aws/"
	npm ci --omit=dev --prefix "$(ARTIFACTS_DIR)"
