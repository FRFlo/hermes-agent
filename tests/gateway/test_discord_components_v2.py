"""Behavior contracts for Discord Components V2 payload construction."""

from types import SimpleNamespace

from plugins.platforms.discord.views.components_v2 import (
    add_file_components,
    build_media_view,
    build_text_view,
    components_v2_available,
)


def test_supported_discord_builds_text_display_view():
    class TextDisplay:
        def __init__(self, content):
            self.content = content

    class LayoutView:
        def __init__(self, timeout=None):
            self.children = []
            self._children = self.children
        def add_item(self, item):
            self.children.append(item)

    fake_discord = SimpleNamespace(ui=SimpleNamespace(LayoutView=LayoutView, TextDisplay=TextDisplay))
    view = build_text_view(fake_discord, "hello")
    assert components_v2_available(fake_discord)
    assert view is not None
    assert view.children[0].content == "hello"


def test_v2_file_components_reference_every_uploaded_filename():
    class LayoutView:
        def __init__(self, timeout=None):
            self.children = []
            self._children = self.children
        def add_item(self, item):
            self.children.append(item)
    fake_discord = SimpleNamespace(ui=SimpleNamespace(
        LayoutView=LayoutView,
        TextDisplay=lambda content: SimpleNamespace(content=content),
        File=lambda media: SimpleNamespace(media=media),
    ))
    view = build_text_view(fake_discord, "attachments")
    files = [SimpleNamespace(filename="one.txt"), SimpleNamespace(filename="two.txt")]
    assert view is not None
    assert add_file_components(view, fake_discord, files)
    assert [component.media for component in view.children[1:]] == [
        "attachment://one.txt", "attachment://two.txt",
    ]


def test_attachment_only_media_still_gets_a_v2_layout():
    class LayoutView:
        def __init__(self, timeout=None):
            self.children = []
            self._children = self.children
        def add_item(self, item):
            self.children.append(item)
    fake_discord = SimpleNamespace(ui=SimpleNamespace(
        LayoutView=LayoutView,
        TextDisplay=lambda content: SimpleNamespace(content=content),
        File=lambda media: SimpleNamespace(media=media),
    ))
    view = build_media_view(fake_discord, "", [SimpleNamespace(filename="image.png")])
    assert view is not None
    assert view.children[0].media == "attachment://image.png"
