#!/usr/bin/env python3
"""Re-encode eligible embedded GLB PNG textures without touching mesh data.

Use the bundled runtime so Pillow is available:

  /Users/bedelau/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \\
    blender/optimize_glb_textures.py input.glb output.glb --dry-run

Only opaque PNG images referenced as base-color, normal, or metallic-roughness
textures are converted. Geometry, skins, animations, and all other buffer-view
payloads are copied byte-for-byte. Buffer views are rebuilt on four-byte
boundaries and their offsets/lengths and JPEG MIME metadata are updated.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - depends on the invoking runtime
    raise SystemExit(
        "Pillow is required. Use the bundled Codex Python runtime documented above."
    ) from error


GLB_MAGIC = 0x46546C67
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
ALIGNMENT = 4
QUALITY = 94
TEXTURE_ROLES = ("baseColorTexture", "normalTexture", "metallicRoughnessTexture")


@dataclass(frozen=True)
class Glb:
    document: dict[str, Any]
    binary: bytes
    other_chunks: tuple[tuple[int, bytes], ...]


def align4(value: int) -> int:
    return (value + ALIGNMENT - 1) // ALIGNMENT * ALIGNMENT


def parse_glb(path: Path) -> Glb:
    data = path.read_bytes()
    if len(data) < 12:
        raise ValueError("File is too short to be a GLB.")
    magic, version, declared_length = struct.unpack_from("<III", data, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION:
        raise ValueError("Expected a version-2 GLB file.")
    if declared_length != len(data):
        raise ValueError("GLB header length does not match file length.")

    cursor = 12
    json_chunk: bytes | None = None
    bin_chunk: bytes | None = None
    other_chunks: list[tuple[int, bytes]] = []
    while cursor < len(data):
        if cursor + 8 > len(data):
            raise ValueError("Truncated GLB chunk header.")
        chunk_length, chunk_type = struct.unpack_from("<II", data, cursor)
        cursor += 8
        end = cursor + chunk_length
        if end > len(data):
            raise ValueError("Truncated GLB chunk payload.")
        payload = data[cursor:end]
        cursor = end
        if chunk_type == JSON_CHUNK:
            if json_chunk is not None:
                raise ValueError("GLB contains more than one JSON chunk.")
            json_chunk = payload
        elif chunk_type == BIN_CHUNK:
            if bin_chunk is not None:
                raise ValueError("GLB contains more than one BIN chunk.")
            bin_chunk = payload
        else:
            other_chunks.append((chunk_type, payload))
    if json_chunk is None or bin_chunk is None:
        raise ValueError("GLB must contain one JSON chunk and one BIN chunk.")
    try:
        document = json.loads(json_chunk.rstrip(b" \t\r\n\0").decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("GLB JSON chunk is invalid.") from error
    if not isinstance(document, dict):
        raise ValueError("GLB JSON root must be an object.")
    return Glb(document, bin_chunk, tuple(other_chunks))


def texture_image_indices(document: dict[str, Any]) -> dict[int, set[str]]:
    """Return image indices used by exactly the allowed material texture roles."""
    textures = document.get("textures", [])
    if not isinstance(textures, list):
        raise ValueError("textures must be an array.")

    image_for_texture: dict[int, int] = {}
    for texture_index, texture in enumerate(textures):
        if not isinstance(texture, dict):
            continue
        source = texture.get("source")
        basisu = texture.get("extensions", {}).get("KHR_texture_basisu", {})
        if isinstance(basisu, dict):
            source = basisu.get("source", source)
        if isinstance(source, int):
            image_for_texture[texture_index] = source

    roles: dict[int, set[str]] = {}
    for material in document.get("materials", []):
        if not isinstance(material, dict):
            continue
        pbr = material.get("pbrMetallicRoughness", {})
        slots: list[tuple[str, Any]] = [
            ("baseColorTexture", pbr.get("baseColorTexture") if isinstance(pbr, dict) else None),
            ("metallicRoughnessTexture", pbr.get("metallicRoughnessTexture") if isinstance(pbr, dict) else None),
            ("normalTexture", material.get("normalTexture")),
        ]
        for role, texture_info in slots:
            if not isinstance(texture_info, dict):
                continue
            texture_index = texture_info.get("index")
            image_index = image_for_texture.get(texture_index)
            if image_index is not None:
                roles.setdefault(image_index, set()).add(role)
    return roles


def png_is_opaque(payload: bytes) -> tuple[bool, tuple[int, int]]:
    with Image.open(io.BytesIO(payload)) as image:
        image.load()
        dimensions = image.size
        alpha = image.convert("RGBA").getchannel("A").getextrema()
        return alpha == (255, 255), dimensions


def jpeg_payload(png: bytes, dimensions: tuple[int, int]) -> bytes:
    with Image.open(io.BytesIO(png)) as image:
        image.load()
        if image.size != dimensions:
            raise ValueError("Image dimensions changed while reading PNG.")
        output = io.BytesIO()
        image.convert("RGB").save(
            output,
            format="JPEG",
            quality=QUALITY,
            subsampling=0,
            optimize=True,
            progressive=False,
        )
    encoded = output.getvalue()
    with Image.open(io.BytesIO(encoded)) as result:
        if result.size != dimensions:
            raise ValueError("JPEG encoder changed image dimensions.")
    return encoded


def referenced_accessor_views(document: dict[str, Any]) -> set[int]:
    """Views used by accessors must never be interpreted as an image payload."""
    result: set[int] = set()
    for accessor in document.get("accessors", []):
        if isinstance(accessor, dict) and isinstance(accessor.get("bufferView"), int):
            result.add(accessor["bufferView"])
    return result


def eligible_replacements(glb: Glb) -> tuple[dict[int, bytes], list[dict[str, Any]]]:
    document, binary = glb.document, glb.binary
    images = document.get("images", [])
    views = document.get("bufferViews", [])
    if not isinstance(images, list) or not isinstance(views, list):
        raise ValueError("images and bufferViews must be arrays.")

    roles_by_image = texture_image_indices(document)
    accessor_views = referenced_accessor_views(document)
    replacements: dict[int, bytes] = {}
    report: list[dict[str, Any]] = []
    for image_index, roles in sorted(roles_by_image.items()):
        if image_index < 0 or image_index >= len(images) or not isinstance(images[image_index], dict):
            raise ValueError(f"Texture references invalid image index {image_index}.")
        image = images[image_index]
        if image.get("mimeType") != "image/png" or not isinstance(image.get("bufferView"), int):
            continue
        view_index = image["bufferView"]
        if view_index < 0 or view_index >= len(views) or not isinstance(views[view_index], dict):
            raise ValueError(f"Image {image_index} references invalid bufferView {view_index}.")
        if view_index in accessor_views:
            raise ValueError(f"Image {image_index} shares bufferView {view_index} with an accessor; refusing to alter geometry data.")
        view = views[view_index]
        if view.get("buffer", 0) != 0:
            raise ValueError("This optimizer supports embedded GLB buffer 0 only.")
        offset, length = view.get("byteOffset", 0), view.get("byteLength")
        if not isinstance(offset, int) or not isinstance(length, int) or offset < 0 or length < 1 or offset + length > len(binary):
            raise ValueError(f"Image {image_index} has an invalid bufferView range.")
        original = binary[offset : offset + length]
        opaque, dimensions = png_is_opaque(original)
        if not opaque:
            report.append({"image": image_index, "roles": sorted(roles), "status": "skipped-alpha", "bytes": length})
            continue
        encoded = jpeg_payload(original, dimensions)
        existing = replacements.get(view_index)
        if existing is not None and existing != encoded:
            raise ValueError(f"Multiple images share bufferView {view_index} with incompatible conversions.")
        replacements[view_index] = encoded
        report.append({"image": image_index, "roles": sorted(roles), "status": "converted", "old_bytes": length, "new_bytes": len(encoded), "dimensions": dimensions})
    return replacements, report


def rebuild(glb: Glb, replacements: dict[int, bytes]) -> bytes:
    document = json.loads(json.dumps(glb.document))
    views = document.get("bufferViews", [])
    original_views = glb.document.get("bufferViews", [])
    output_binary = bytearray()
    for index, view in enumerate(views):
        if not isinstance(view, dict) or not isinstance(original_views[index], dict):
            raise ValueError("bufferViews must contain objects.")
        original = original_views[index]
        offset, length = original.get("byteOffset", 0), original.get("byteLength")
        if not isinstance(offset, int) or not isinstance(length, int):
            raise ValueError(f"bufferView {index} lacks an integer range.")
        payload = replacements.get(index, glb.binary[offset : offset + length])
        if len(payload) != length and index not in replacements:
            raise AssertionError("Non-image buffer-view payload was not copied exactly.")
        output_binary.extend(b"\0" * (align4(len(output_binary)) - len(output_binary)))
        view["byteOffset"] = len(output_binary)
        view["byteLength"] = len(payload)
        output_binary.extend(payload)

    buffers = document.get("buffers", [])
    if not isinstance(buffers, list) or not buffers or not isinstance(buffers[0], dict):
        raise ValueError("GLB must have an embedded buffers[0] object.")
    buffers[0]["byteLength"] = len(output_binary)
    for image in document.get("images", []):
        if isinstance(image, dict) and isinstance(image.get("bufferView"), int) and image["bufferView"] in replacements:
            image["mimeType"] = "image/jpeg"

    json_payload = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_payload += b" " * (align4(len(json_payload)) - len(json_payload))
    bin_payload = bytes(output_binary)
    bin_payload += b"\0" * (align4(len(bin_payload)) - len(bin_payload))
    chunks = [(JSON_CHUNK, json_payload), (BIN_CHUNK, bin_payload), *glb.other_chunks]
    total_length = 12 + sum(8 + len(payload) for _, payload in chunks)
    result = bytearray(struct.pack("<III", GLB_MAGIC, GLB_VERSION, total_length))
    for chunk_type, payload in chunks:
        result.extend(struct.pack("<II", len(payload), chunk_type))
        result.extend(payload)
    return bytes(result)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_glb", type=Path, help="existing GLB to inspect")
    parser.add_argument("output_glb", type=Path, help="new GLB path; never overwritten")
    parser.add_argument("--dry-run", action="store_true", help="report eligible conversions without writing output")
    arguments = parser.parse_args()
    if not arguments.input_glb.is_file():
        parser.error(f"input GLB does not exist: {arguments.input_glb}")
    if arguments.input_glb.resolve() == arguments.output_glb.resolve():
        parser.error("output_glb must differ from input_glb")
    if not arguments.dry_run and arguments.output_glb.exists():
        parser.error(f"refusing to overwrite existing output: {arguments.output_glb}")

    glb = parse_glb(arguments.input_glb)
    replacements, report = eligible_replacements(glb)
    old_image_bytes = sum(item.get("old_bytes", 0) for item in report)
    new_image_bytes = sum(item.get("new_bytes", 0) for item in report)
    print(json.dumps({"input": str(arguments.input_glb), "converted": report, "eligible_views": len(replacements), "image_bytes_before": old_image_bytes, "image_bytes_after": new_image_bytes}, indent=2))
    if arguments.dry_run:
        return 0
    rebuilt = rebuild(glb, replacements)
    arguments.output_glb.parent.mkdir(parents=True, exist_ok=True)
    arguments.output_glb.write_bytes(rebuilt)
    print(f"wrote {arguments.output_glb} ({len(rebuilt)} bytes; input {arguments.input_glb.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
