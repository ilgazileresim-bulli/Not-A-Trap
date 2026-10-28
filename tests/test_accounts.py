import json
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class AccountTests(unittest.TestCase):
    def test_password_digest_is_deterministic_and_not_plaintext(self):
        first = server.password_digest("correct-horse", "001122")
        second = server.password_digest("correct-horse", "001122")
        different = server.password_digest("correct-horse", "aabbcc")
        self.assertEqual(first, second)
        self.assertNotEqual(first, different)
        self.assertNotIn("correct-horse", first)
        self.assertEqual(len(first), 64)

    def test_account_store_round_trip(self):
        account_path = Path(__file__).parent / ".account-test.json"
        try:
            payload = server.blank_account_store()
            payload["accounts"]["player.one"] = {
                "username": "Player.One",
                "salt": "salt",
                "password_hash": "digest",
                "created_at": 10,
                "stats": {"highest_unlocked": 49, "deaths": 12, "attempts": 22},
            }
            with patch.object(server, "ACCOUNT_PATH", account_path):
                server.save_account_store(payload)
                loaded = server.load_account_store()
            self.assertEqual(loaded["accounts"]["player.one"]["username"], "Player.One")
            self.assertEqual(json.loads(account_path.read_text(encoding="utf-8"))["version"], 1)
        finally:
            account_path.unlink(missing_ok=True)
            account_path.with_suffix(".tmp").unlink(missing_ok=True)

    def test_public_player_clamps_and_builds_achievements(self):
        profile = server.public_player({
            "username": "Runner",
            "created_at": 1,
            "stats": {"highest_unlocked": 999, "completed_levels": 999, "deaths": 101, "attempts": 400},
        })
        self.assertEqual(profile["stats"]["highest_unlocked"], 220)
        self.assertEqual(profile["stats"]["progress"], 100.0)
        self.assertIn("HİÇBİR ŞEYE GÜVENMEDİ", profile["achievements"])
        self.assertIn("100 KERE YİNE", profile["achievements"])

    def test_username_and_password_policy(self):
        self.assertEqual(server.normalize_username("Player_01"), "player_01")
        with self.assertRaises(ValueError):
            server.normalize_username("x")
        with self.assertRaises(ValueError):
            server.normalize_username("bad name")
        with self.assertRaises(ValueError):
            server.validate_password("123")


if __name__ == "__main__":
    unittest.main()
