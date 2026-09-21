"""Regression tests for automatic Totalplay Lovelace resource registration."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / "custom_components" / "totalplay_stb" / "card_resource.py"
)
spec = importlib.util.spec_from_file_location("totalplay_card_resource", MODULE_PATH)
card_resource = importlib.util.module_from_spec(spec)
spec.loader.exec_module(card_resource)


class FakeResources:
    """Model older Home Assistant versions that do not lazy-load on writes."""

    def __init__(self, stored=()):
        self.stored = [dict(item) for item in stored]
        self.items = []  # Empty until async_get_info is called.
        self.loaded = False
        self.created = []
        self.updated = []

    async def async_get_info(self):
        if not self.loaded:
            self.items = [dict(item) for item in self.stored]
            self.loaded = True
        return {"resources": len(self.items)}

    def async_items(self):
        return self.items

    async def async_create_item(self, data):
        assert self.loaded, "Existing resource collection was not loaded"
        self.created.append(dict(data))
        item = {**data, "type": data["res_type"], "id": "created"}
        self.items.append(item)
        return item

    async def async_update_item(self, item_id, changes):
        assert self.loaded, "Existing resource collection was not loaded"
        self.updated.append((item_id, dict(changes)))
        for item in self.items:
            if item["id"] == item_id:
                item["url"] = changes["url"]
                item["type"] = changes["res_type"]
                return item
        raise AssertionError("Unknown resource id")


def fake_hass(resources, mode="storage"):
    return SimpleNamespace(
        data={"lovelace": SimpleNamespace(resource_mode=mode, resources=resources)}
    )


class CardResourceTests(unittest.IsolatedAsyncioTestCase):
    async def test_registers_automatically_without_losing_existing_resources(self):
        original = {"id": "other", "url": "/local/other-card.js", "type": "module"}
        resources = FakeResources([original])
        result = await card_resource.async_register_card_resource(fake_hass(resources))
        self.assertTrue(result)
        self.assertTrue(resources.loaded)
        self.assertEqual(resources.items[0], original)
        self.assertEqual(resources.created, [{
            "url": card_resource._versioned_url(), "res_type": "module"
        }])

    async def test_updates_previous_version_without_creating_duplicate(self):
        old = {"id": "totalplay", "url": f"{card_resource.CARD_PATH}?v=0.2.4", "type": "module"}
        resources = FakeResources([old])
        self.assertTrue(await card_resource.async_register_card_resource(fake_hass(resources)))
        self.assertEqual(resources.created, [])
        self.assertEqual(resources.updated, [("totalplay", {
            "url": card_resource._versioned_url(), "res_type": "module"
        })])

    async def test_registration_is_idempotent(self):
        resources = FakeResources()
        hass = fake_hass(resources)
        self.assertTrue(await card_resource.async_register_card_resource(hass))
        self.assertTrue(await card_resource.async_register_card_resource(hass))
        self.assertEqual(len(resources.created), 1)
        self.assertEqual(resources.updated, [])

    async def test_never_modifies_yaml_resources(self):
        resources = FakeResources()
        self.assertFalse(await card_resource.async_register_card_resource(fake_hass(resources, "yaml")))
        self.assertFalse(resources.loaded)
        self.assertEqual(resources.created, [])

    async def test_ambiguous_existing_resources_are_left_untouched(self):
        old = [
            {"id": "a", "url": card_resource.CARD_PATH, "type": "module"},
            {"id": "b", "url": f"{card_resource.CARD_PATH}?v=0.2.4", "type": "module"},
        ]
        resources = FakeResources(old)
        self.assertFalse(await card_resource.async_register_card_resource(fake_hass(resources)))
        self.assertEqual(resources.created, [])
        self.assertEqual(resources.updated, [])

    async def test_leaves_unrelated_resources_alone(self):
        other = {"id": "x", "url": "/hacsfiles/some-card/card.js", "type": "module"}
        resources = FakeResources([other])
        self.assertTrue(await card_resource.async_register_card_resource(fake_hass(resources)))
        self.assertEqual(resources.items[0], other)


if __name__ == "__main__":
    unittest.main()
