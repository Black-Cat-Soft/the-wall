"""Check refusal paths before scripts can create chargeable resources."""

from contextlib import redirect_stdout
import io
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from provision import launch_instance, security_group, verify_account


class DeploymentSafetyTests(unittest.TestCase):
    def test_account_guard_refuses_wrong_account_paid_plan_and_low_credits(self):
        for identity, plan in (
            ({"Account": "other"}, None),
            ({"Account": "expected"}, {"accountPlanType": "PAID", "accountPlanStatus": "ACTIVE"}),
            ({"Account": "expected"}, {"accountPlanType": "FREE", "accountPlanStatus": "EXPIRED"}),
            ({"Account": "expected"}, {"accountPlanType": "FREE", "accountPlanStatus": "ACTIVE", "accountPlanRemainingCredits": {"amount": 4}}),
        ):
            with self.subTest(identity=identity, plan=plan):
                aws = Mock()
                aws.call.side_effect = [identity, plan]
                with self.assertRaises(RuntimeError), redirect_stdout(io.StringIO()):
                    verify_account(aws, "expected")
                self.assertTrue(all(call.args[1] in ("get-caller-identity", "get-account-plan-state") for call in aws.call.call_args_list))

    def test_instance_retry_reuses_matching_running_instance(self):
        aws = Mock()
        aws.call.return_value = {"Reservations": [{"Instances": [{"InstanceId": "i-existing", "ClientToken": "wall-test-abc", "State": {"Name": "running"}}]}]}
        args = SimpleNamespace(name="wall", image_tag="test-abc")
        self.assertEqual(launch_instance(aws, args, "sg-example"), "i-existing")
        aws.call.assert_called_once()

    def test_instance_name_collision_does_not_launch_another_instance(self):
        aws = Mock()
        aws.call.return_value = {"Reservations": [{"Instances": [{"InstanceId": "i-other", "ClientToken": "unrelated", "State": {"Name": "running"}}]}]}
        with self.assertRaises(RuntimeError):
            launch_instance(aws, SimpleNamespace(name="wall", image_tag="test-abc"), "sg-example")
        aws.call.assert_called_once()

    def test_existing_security_group_with_ssh_requires_inspection(self):
        aws = Mock()
        aws.call.return_value = {"SecurityGroups": [{"GroupId": "sg-existing", "Tags": [{"Key": "Project", "Value": "the-wall"}, {"Key": "Environment", "Value": "test"}], "IpPermissions": [{"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}]}]}]}
        with self.assertRaises(RuntimeError):
            security_group(aws, SimpleNamespace(name="wall", vpc="vpc-example"))
        aws.call.assert_called_once()


if __name__ == "__main__":
    unittest.main()
