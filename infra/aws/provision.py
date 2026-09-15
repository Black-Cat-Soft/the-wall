"""Provision the approved single-host test deployment from AWS CloudShell.

Requires an existing private ECR repository and scoped EC2 instance profile.
Refuses paid accounts. Never upgrades the account or modifies DNS.
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


class AWS:
    """Run AWS CLI requests with a fixed region and structured JSON output."""

    def __init__(self, region):
        self.region = region

    def call(self, *args):
        result = subprocess.run(
            ["aws", *args, "--region", self.region, "--output", "json", "--no-cli-pager"],
            check=True, capture_output=True, text=True,
        )
        return json.loads(result.stdout) if result.stdout.strip() else None


def verify_account(aws, expected):
    identity = aws.call("sts", "get-caller-identity")
    if identity["Account"] != expected:
        raise RuntimeError("AWS account does not match the approved account")
    plan = aws.call("freetier", "get-account-plan-state")
    if plan["accountPlanType"] != "FREE" or plan["accountPlanStatus"] != "ACTIVE":
        raise RuntimeError("An active AWS Free Plan is required; no changes made")
    if plan["accountPlanRemainingCredits"]["amount"] < 5:
        raise RuntimeError("Insufficient free credits for this test deployment")
    print("Verified active Free Plan:", plan["accountPlanRemainingCredits"], flush=True)


def push_image(aws, args):
    archive = Path(args.archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != args.archive_sha256:
        raise RuntimeError("Image archive checksum does not match")
    repository = aws.call("ecr", "describe-repositories", "--repository-names", args.repository)["repositories"][0]
    uri = repository["repositoryUri"]
    # Reuse an already-pushed immutable tag when resuming this deployment.
    images = aws.call("ecr", "list-images", "--repository-name", args.repository)["imageIds"]
    if not any(item.get("imageTag") == args.image_tag for item in images):
        subprocess.run(["docker", "load", "-i", str(archive)], check=True)
        subprocess.run(["docker", "tag", args.local_image, uri + ":" + args.image_tag], check=True)
        password = subprocess.check_output(["aws", "ecr", "get-login-password", "--region", aws.region])
        with tempfile.TemporaryDirectory(prefix="wall-docker-") as config:
            subprocess.run(["docker", "--config", config, "login", "--username", "AWS", "--password-stdin", uri.split("/")[0]], input=password, check=True)
            subprocess.run(["docker", "--config", config, "push", uri + ":" + args.image_tag], check=True)
    detail = aws.call("ecr", "describe-images", "--repository-name", args.repository, "--image-ids", "imageTag=" + args.image_tag)["imageDetails"][0]
    return uri + "@" + detail["imageDigest"]


def tags(name):
    return [{"Key": "Name", "Value": name}, {"Key": "Project", "Value": "the-wall"}, {"Key": "Environment", "Value": "test"}]


def security_group(aws, args):
    groups = aws.call("ec2", "describe-security-groups", "--filters", "Name=vpc-id,Values=" + args.vpc, "Name=group-name,Values=" + args.name)["SecurityGroups"]
    if groups:
        group = groups[0]
        group_tags = {tag["Key"]: tag["Value"] for tag in group.get("Tags", [])}
        if group_tags.get("Project") != "the-wall" or group_tags.get("Environment") != "test":
            raise RuntimeError("An unrelated security group already uses this name")
        expected = {80, 443}
        actual = {rule.get("FromPort") for rule in group["IpPermissions"]}
        if actual != expected or any(rule.get("IpProtocol") != "tcp" or rule.get("FromPort") != rule.get("ToPort") or rule.get("IpRanges") != [{"CidrIp": "0.0.0.0/0"}] or rule.get("Ipv6Ranges") or rule.get("UserIdGroupPairs") or rule.get("PrefixListIds") for rule in group["IpPermissions"]):
            raise RuntimeError("Existing group differs from the approved HTTP/HTTPS rules")
        return group["GroupId"]
    group_id = aws.call("ec2", "create-security-group", "--group-name", args.name, "--description", "The Wall test HTTPS endpoint; administration through SSM", "--vpc-id", args.vpc, "--tag-specifications", json.dumps([{"ResourceType": "security-group", "Tags": tags(args.name)}]))["GroupId"]
    rules = [{"IpProtocol": "tcp", "FromPort": port, "ToPort": port, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]} for port in (80, 443)]
    aws.call("ec2", "authorize-security-group-ingress", "--group-id", group_id, "--ip-permissions", json.dumps(rules))
    return group_id


def launch_instance(aws, args, group_id):
    token = args.name + "-" + args.image_tag
    reservations = aws.call("ec2", "describe-instances", "--filters", "Name=tag:Name,Values=" + args.name, "Name=instance-state-name,Values=pending,running,stopping,stopped")["Reservations"]
    existing = [instance for reservation in reservations for instance in reservation["Instances"]]
    if existing:
        if len(existing) != 1 or existing[0].get("ClientToken") != token:
            raise RuntimeError("An unrelated instance already uses this name")
        if existing[0]["State"]["Name"] not in ("pending", "running"):
            raise RuntimeError("The existing test instance is stopped; inspect before restarting")
        return existing[0]["InstanceId"]
    subnets = aws.call("ec2", "describe-subnets", "--filters", "Name=vpc-id,Values=" + args.vpc, "Name=default-for-az,Values=true")["Subnets"]
    public = sorted([subnet for subnet in subnets if subnet["MapPublicIpOnLaunch"]], key=lambda subnet: subnet["AvailabilityZone"])
    if not public:
        raise RuntimeError("No default public subnet found in the approved VPC")
    bootstrap = Path(__file__).with_name("ec2-bootstrap.sh").read_bytes()
    specification = {
        "ImageId": args.ami, "InstanceType": "t3.micro", "MinCount": 1, "MaxCount": 1,
        "ClientToken": token, "IamInstanceProfile": {"Name": args.profile},
        "CreditSpecification": {"CpuCredits": "standard"},
        "MetadataOptions": {"HttpTokens": "required", "HttpEndpoint": "enabled", "HttpPutResponseHopLimit": 1},
        "NetworkInterfaces": [{"DeviceIndex": 0, "SubnetId": public[0]["SubnetId"], "Groups": [group_id], "AssociatePublicIpAddress": True, "DeleteOnTermination": True}],
        "BlockDeviceMappings": [{"DeviceName": "/dev/xvda", "Ebs": {"VolumeSize": 20, "VolumeType": "gp3", "Encrypted": True, "DeleteOnTermination": False}}],
        "TagSpecifications": [{"ResourceType": resource, "Tags": tags(args.name)} for resource in ("instance", "volume")],
        "UserData": base64.b64encode(bootstrap).decode(),
    }
    return aws.call("ec2", "run-instances", "--cli-input-json", json.dumps(specification))["Instances"][0]["InstanceId"]


def elastic_ip(aws, args, instance_id):
    addresses = aws.call("ec2", "describe-addresses", "--filters", "Name=tag:Name,Values=" + args.name)["Addresses"]
    if len(addresses) > 1:
        raise RuntimeError("Multiple test Elastic IPs found; inspect before continuing")
    address = addresses[0] if addresses else aws.call("ec2", "allocate-address", "--domain", "vpc", "--tag-specifications", json.dumps([{"ResourceType": "elastic-ip", "Tags": tags(args.name)}]))
    if address.get("AssociationId") and address.get("InstanceId") != instance_id:
        raise RuntimeError("The Elastic IP is associated with another resource")
    if address.get("InstanceId") != instance_id:
        aws.call("ec2", "associate-address", "--instance-id", instance_id, "--allocation-id", address["AllocationId"], "--no-allow-reassociation")
    return address


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ("account", "vpc", "ami", "archive", "archive-sha256"):
        parser.add_argument("--" + argument, required=True)
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--name", default="the-wall-test")
    parser.add_argument("--profile", default="the-wall-test-ec2")
    parser.add_argument("--repository", default="the-wall-backend")
    parser.add_argument("--image-tag", default="test-520dd92")
    parser.add_argument("--local-image", default="the-wall-backend:container-readiness")
    args = parser.parse_args()
    aws = AWS(args.region)
    verify_account(aws, args.account)
    image = push_image(aws, args)
    group = security_group(aws, args)
    instance = launch_instance(aws, args, group)
    state = {"region": args.region, "image": image, "instanceId": instance, "securityGroupId": group}
    Path("wall-state.json").write_text(json.dumps(state, indent=2) + "\n")
    print("Instance created; waiting for running state:", instance, flush=True)
    aws.call("ec2", "wait", "instance-running", "--instance-ids", instance)
    address = elastic_ip(aws, args, instance)
    state.update(publicIp=address["PublicIp"], allocationId=address["AllocationId"])
    Path("wall-state.json").write_text(json.dumps(state, indent=2) + "\n")
    print(json.dumps(state, indent=2), flush=True)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr or "Command failed; inspect saved state before retrying")
