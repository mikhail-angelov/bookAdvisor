HOST=$(shell grep '^HOST=' .env | cut -d '=' -f 2)

q: 
	docker run -d --name qdrant -p 6333:6333 -p 6334:6334 -v "$(pwd)/data/qdrant_storage:/qdrant/storage" qdrant/qdrant:latest

crawl:
	@echo "Crawling..."
	npm run crawl
	npm run crawl -- parse

install:
	@echo "Installing server..."
	-ssh root@$(HOST) "mkdir -p /opt/bookAdviser"
	scp ./.env root@$(HOST):/opt/bookAdviser/.env
	scp ./docker-compose.yml root@$(HOST):/opt/bookAdviser/docker-compose.yml

deploy:
	@echo "Deploying server..."
	ssh root@$(HOST) "docker pull ghcr.io/mikhail-angelov/bookadvisor:latest"
	-ssh root@$(HOST) "cd /opt/bookAdviser && docker compose down"
	ssh root@$(HOST) "cd /opt/bookAdviser && docker compose up -d"

migrate-remote:
	@echo "Pulling remote production DB..."
	mkdir -p ./tmp
	rsync root@$(HOST):/opt/bookAdviser/prod.db ./tmp/prod.remote.db
	@echo "Applying Drizzle migrations locally..."
	DB_URL=./tmp/prod.remote.db npm run migrate:run
	@echo "Uploading migrated DB back to server..."
	rsync ./tmp/prod.remote.db root@$(HOST):/opt/bookAdviser/prod.db
	rm -f ./tmp/prod.remote.db
	@echo "Remote migration complete!"