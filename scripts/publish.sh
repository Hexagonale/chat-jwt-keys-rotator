docker build --platform=linux/amd64 -t docker.hexagonale.net/jwt-keys-rotator:latest -t docker.hexagonale.net/jwt-keys-rotator:$1 .
docker push docker.hexagonale.net/jwt-keys-rotator:$1
docker push docker.hexagonale.net/jwt-keys-rotator:latest
