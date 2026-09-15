"""Exercise the test API with synthetic accounts; keep credentials off stdout."""

import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import urllib.error
import urllib.request

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=")


def request(base, path, method="GET", payload=None, token=None, raw=False, content_type=None):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None and not isinstance(payload, bytes):
        payload = json.dumps(payload).encode()
        content_type = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(base + path, data=payload, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read()
        return data if raw else json.loads(data)


def verify(base, state):
    alice, bob = state["users"]
    logged_in = request(base, "/auth/login", "POST", {"email": alice["email"], "password": alice["password"]})
    assert logged_in["user"]["id"] == alice["id"]
    bumps = request(base, "/bumps/my-bumps", token=alice["token"])
    assert any(item["user"]["id"] == bob["id"] for item in bumps)
    posts = request(base, "/posts/feed", token=bob["token"])
    assert any(post["id"] == state["post"]["id"] for post in posts)
    assert request(base, state["post"]["imageUrl"], raw=True) == PNG
    print("PASS: login, existing JWT, pairing, feed, and exact uploaded image bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--verify-existing", action="store_true")
    args = parser.parse_args()
    assert args.base.startswith("https://"), "Public testing requires verified HTTPS"
    assert request(args.base, "/healthz") == {"status": "ok"}
    print("PASS: trusted HTTPS and database health")
    if args.verify_existing:
        return verify(args.base, json.loads(Path(args.state).read_text()))
    if Path(args.state).exists():
        raise SystemExit("State already exists; use --verify-existing to avoid duplicate test accounts")
    try:
        request(args.base, "/posts/feed")
        raise AssertionError("Unauthenticated feed was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 401
    print("PASS: protected endpoint rejects unauthenticated requests")
    suffix = secrets.token_hex(5)
    state = {"users": []}
    for name in ("alice", "bob"):
        user = {"username": "aws_smoke_" + name + "_" + suffix, "email": name + suffix + "@example.invalid", "password": secrets.token_urlsafe(24)}
        result = request(args.base, "/auth/register", "POST", user)
        state["users"].append({**user, "id": result["user"]["id"], "token": result["token"]})
    alice, bob = state["users"]
    assert request(args.base, "/bumps", "POST", {"otherUserId": bob["id"], "method": "ble"}, alice["token"])["success"]
    boundary = "wall" + secrets.token_hex(12)
    body = ("--" + boundary + '\r\nContent-Disposition: form-data; name="caption"\r\n\r\nAWS synthetic deployment check\r\n--' + boundary + '\r\nContent-Disposition: form-data; name="image"; filename="smoke.png"\r\nContent-Type: image/png\r\n\r\n').encode() + PNG + ("\r\n--" + boundary + "--\r\n").encode()
    state["post"] = request(args.base, "/posts", "POST", body, alice["token"], content_type="multipart/form-data; boundary=" + boundary)
    fd = os.open(args.state, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(state, handle)
    print("PASS: two synthetic registrations, BLE pairing request, and photo upload")
    verify(args.base, state)


if __name__ == "__main__":
    main()
