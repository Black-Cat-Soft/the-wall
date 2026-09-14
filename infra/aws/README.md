# Single-host AWS test deployment

These scripts operate on an explicitly approved AWS account. They require Python 3,
AWS CLI, and Docker, all available in AWS CloudShell. They refuse accounts that are
not on an active AWS Free Plan or have less than $5 in credits. They never upgrade
the account or modify DNS. Created resources consume credits while they exist.

The backend runtime preparation (`compose.deploy.yml`, health check, and persistent
volumes) must be present first; see PR #4. Keep AWS provisioning separate from
application changes so resource costs and permissions can be reviewed independently.

## Prerequisites

- A private ECR repository with immutable image tags.
- An EC2 instance profile trusted by EC2, with `AmazonSSMManagedInstanceCore` and
  pull permission for only that repository. ECR authorization needs
  `ecr:GetAuthorizationToken` on `*`; image retrieval needs
  `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, and
  `ecr:BatchCheckLayerAvailability` on the repository ARN.
- A default public subnet in the approved VPC and an Amazon Linux 2023 x86 AMI.
- An image archive built and tested for `linux/amd64`, plus its SHA-256 checksum.
- Approval for one `t3.micro`, 20 GiB encrypted gp3 disk, an Elastic IP, and public
  ports 80/443. No inbound SSH or port 3000 is created.

## Build and upload

From the application repository, build the reviewed backend commit and export it:

```sh
docker build --platform linux/amd64 -t the-wall-backend:container-readiness ./backend
docker save --platform linux/amd64 -o backend.tar the-wall-backend:container-readiness
shasum -a 256 backend.tar
```

Upload the image archive and a bundle containing `infra/aws/` and the application
`compose.deploy.yml` to CloudShell. Do not include `.env`, databases, uploads, or
credentials. The archive checksum is checked before the image is loaded or pushed.

## Provision

Replace the explicit account, VPC, AMI, tag, and checksum with the reviewed values:

```sh
python3 infra/aws/provision.py \
  --account ACCOUNT_ID --vpc VPC_ID --ami AMI_ID \
  --archive backend.tar --archive-sha256 ARCHIVE_SHA256 \
  --image-tag test-COMMIT
```

The script pushes the image to ECR, starts one instance with standard CPU credits,
requires IMDSv2, and associates a stable Elastic IP. It writes `wall-state.json`
with the image digest and resource IDs. Keep this file outside Git. If a run is
interrupted, inspect its recorded resources before retrying. Name/tag checks and an
EC2 client token prevent routine retries from creating duplicate instances. A
partially configured security group requires inspection rather than automatic repair.

Bootstrap installs a checksum-verified Docker Compose version. It generates the JWT
secret once on the instance and stores it in a root-only file. Secrets are never
included in user data, the image, or deployment command output.

## Start the application

Wait for Systems Manager to show the instance as online. Add a DNS-only A record
for the approved test hostname pointing to the recorded Elastic IP, then run:

```sh
python3 infra/aws/deploy.py --account ACCOUNT_ID --hostname API_HOSTNAME
```

This sends an SSM command; dispatch is not completion. Check the saved command ID
with `aws ssm get-command-invocation`, then verify the public HTTPS `/healthz` URL,
login, pairing, image upload/feed, and persistence after container replacement.
Caddy obtains a publicly trusted certificate, redirects HTTP to HTTPS, and proxies
to the backend over the private Docker network. Its certificate storage persists.

## Cost, recovery, and limits

The Free Plan consumes credits and expires when credits or its time allowance end.
Do not upgrade it when the requirement is zero out-of-pocket cost. At the observed
Northern Virginia prices, this configuration uses roughly $13/month in baseline
credits if left running, plus ECR storage and usage. Check current prices and the
account's Free Plan status before each session. The script checks this when run;
it does not monitor balances or shut the server down later.

Stopping the instance stops compute usage; the Elastic IP and retained disk still
consume credits. Disk retention prevents instance termination from silently deleting
the database and photos. It is not a backup. Deliberate teardown needs separate disk
and Elastic IP cleanup. Use synthetic data until backups and restore are tested.
This is a single-server test environment; it has no automatic failover.

## Local checks

```sh
python3 -m unittest discover -s infra/aws -p 'test_*.py' -v
bash -n infra/aws/ec2-bootstrap.sh
```

The safety tests check refusal of paid/expired accounts, low credits, conflicting
instances, and unexpected public SSH access. They also check that an interrupted
run reuses its existing instance. These checks make no AWS requests.

References: [ECR workflow](https://docs.aws.amazon.com/AmazonECR/latest/userguide/getting-started-cli.html),
[Free Plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html),
[Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html).
