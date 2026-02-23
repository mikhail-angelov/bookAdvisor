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
	ssh root@$(HOST) "cd /opt/bookAdviser && docker compose down"
	ssh root@$(HOST) "cd /opt/bookAdviser && docker compose up -d"

migrate-remote:
	@echo "Applying migrations to remote DB via SSHFS..."
	mkdir -p ./remote_db
	@echo "Mounting /opt/bookAdviser to ./remote_db..."
	sshfs root@$(HOST):/opt/bookAdviser ./remote_db
	@echo "Running Drizzle migrations..."
	DB_URL=./remote_db/prod.db npx drizzle-kit migrate || (umount ./remote_db && rm -rf ./remote_db && exit 1)
	@echo "Unmounting ./remote_db..."
	umount ./remote_db
	rm -rf ./remote_db
	@echo "Remote migration complete!"