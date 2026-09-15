#!/bin/bash
# Amazon Linux 2023: prepare the host. Application deployment is a separate step.
set -euo pipefail

# Amazon Linux already provides curl-minimal, which supports HTTPS downloads.
# Installing the full curl package conflicts with that preinstalled package.
dnf install -y docker amazon-ssm-agent openssl
systemctl enable --now docker amazon-ssm-agent

# Install a specific official Docker Compose release and verify its checksum.
compose_version=v5.5.1
compose_work=$(mktemp -d)
trap 'rm -rf "$compose_work"' EXIT
cd "$compose_work"
curl --fail --silent --show-error --location --remote-name "https://github.com/docker/compose/releases/download/$compose_version/docker-compose-linux-x86_64"
printf '%s  docker-compose-linux-x86_64\n' 'db1889184726840f75c4f9c001048430d4f25b3be3cb084d3ddd762bc0aed576' | sha256sum --check
install -d -m 0755 /usr/local/lib/docker/cli-plugins
install -m 0755 docker-compose-linux-x86_64 /usr/local/lib/docker/cli-plugins/docker-compose

install -d -m 0700 /opt/the-wall
# Generate once on the server; keep it out of user data, Git, and logs.
if [ ! -e /opt/the-wall/runtime.env ]; then
    umask 077
    printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" > /opt/the-wall/runtime.env
fi

docker compose version
touch /opt/the-wall/bootstrap.ready
