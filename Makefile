HOST=$(shell grep '^HOST=' .env | cut -d '=' -f 2)

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