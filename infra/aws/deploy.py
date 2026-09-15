"""Send a container release to the test instance through AWS Systems Manager."""

import argparse
import base64
import json
from pathlib import Path
import re
import shlex
import subprocess

from provision import AWS, verify_account


CADDY_IMAGE = "caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648"


def write_file(path, content):
    encoded = base64.b64encode(content.encode()).decode()
    return "printf %s " + shlex.quote(encoded) + " | base64 -d > " + shlex.quote(path)


def deployment_commands(image, hostname):
    if not re.fullmatch(r"[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/[a-z0-9/_-]+@sha256:[a-f0-9]{64}", image):
        raise ValueError("Use an ECR image digest, not a mutable tag")
    if not re.fullmatch(r"[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}", hostname):
        raise ValueError("Invalid API hostname")
    registry = image.split("/")[0]
    region = registry.split(".")[3]
    compose = (Path(__file__).resolve().parents[2] / "compose.deploy.yml").read_text()
    proxy = f"""services:
  caddy:
    image: {CADDY_IMAGE}
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    read_only: true
    tmpfs:
      - /tmp:size=16m,mode=1777
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
volumes:
  caddy_data:
  caddy_config:
"""
    return "\n".join([
        "#!/bin/bash", "set -euo pipefail",
        "test -f /opt/the-wall/bootstrap.ready",
        "systemctl is-active --quiet docker",
        "test -s /opt/the-wall/runtime.env",
        "cd /opt/the-wall", "umask 077",
        write_file("compose.deploy.yml", compose),
        write_file("compose.tls.yml", proxy),
        write_file("Caddyfile", hostname + " {\n    reverse_proxy backend:3000\n}\n"),
        write_file("image.env", "BACKEND_IMAGE=" + image + "\n"),
        "wall_docker_config=$(mktemp -d)",
        "trap 'rm -rf \"$wall_docker_config\"' EXIT",
        "aws ecr get-login-password --region " + shlex.quote(region) + " | docker --config \"$wall_docker_config\" login --username AWS --password-stdin " + shlex.quote(registry),
        'docker --config "$wall_docker_config" compose --env-file runtime.env --env-file image.env -f compose.deploy.yml -f compose.tls.yml pull --quiet',
        'docker --config "$wall_docker_config" compose --env-file runtime.env --env-file image.env -f compose.deploy.yml -f compose.tls.yml up -d --wait --wait-timeout 120',
        "curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 2 http://127.0.0.1:3000/healthz",
    ]) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", required=True)
    parser.add_argument("--hostname", required=True)
    parser.add_argument("--state", default="wall-state.json")
    parser.add_argument("--print-commands", action="store_true", help="Print the secret-free deployment script without running AWS commands")
    args = parser.parse_args()
    state = json.loads(Path(args.state).read_text())
    commands = deployment_commands(state["image"], args.hostname)
    if args.print_commands:
        print(commands)
        return
    aws = AWS(state["region"])
    verify_account(aws, args.account)
    response = aws.call("ssm", "send-command", "--instance-ids", state["instanceId"], "--document-name", "AWS-RunShellScript", "--comment", "Deploy The Wall test containers", "--parameters", json.dumps({"commands": [commands], "executionTimeout": ["600"]}))
    command_id = response["Command"]["CommandId"]
    state["deploymentCommandId"] = command_id
    Path(args.state).write_text(json.dumps(state, indent=2) + "\n")
    print("Deployment dispatched. Check SSM command status:", command_id)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr or "Command failed; inspect SSM status before retrying")
