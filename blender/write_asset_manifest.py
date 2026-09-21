"""Write the current browser-GLB manifest without importing Blender modules."""
import argparse
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "site/public/render-assets/models"
DEFAULT_OUTPUT = ROOT / "workstreams/fidelity-reference-20260921/astra-refinement/asset-manifest.json"
SOURCES = {
    "neon-tetra.glb": "Original Fishy tetra geometry, skin, armature, and cyclic action.",
    "plant-broadleaf.glb": "Original Fishy broadleaf geometry with authored botanical PBR maps.",
    "plant-fern.glb": "Adapted Poly Haven Fern 02 (CC0); Rico Cilliers (modeling), Rob Tuytel (scanning).",
    "plant-grass.glb": "Original Fishy grass geometry with authored botanical PBR maps.",
    "plant-moss.glb": "Original Fishy moss geometry with authored botanical PBR maps.",
    "plant-stem.glb": "Original Fishy stem geometry with authored botanical PBR maps.",
    "rock-rounded.glb": "Original Fishy fractured rock geometry with Poly Haven dark_rock CC0 PBR maps.",
    "rock-strata.glb": "Original Fishy fractured rock geometry with Poly Haven lichen_rock CC0 mineral PBR maps.",
    "wood-arch.glb": "Original Fishy wood geometry with Poly Haven bark_willow CC0 PBR maps.",
    "wood-root.glb": "Original Fishy root geometry with Poly Haven bark_willow CC0 PBR maps.",
    "wood-stump.glb": "Original Fishy stump geometry with Poly Haven bark_willow CC0 PBR maps.",
}


def glb_json(path: Path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data)
    if (magic, version, total) != (b"glTF", 2, len(data)):
        raise ValueError(f"Invalid GLB header: {path}")
    chunk_length, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise ValueError(f"First GLB chunk is not JSON: {path}")
    return json.loads(data[20:20 + chunk_length])


def primitive_triangles(primitive, accessors):
    accessor = primitive.get("indices", primitive["attributes"]["POSITION"])
    count = accessors[accessor]["count"]
    mode = primitive.get("mode", 4)
    if mode == 4:
        return count // 3
    if mode in (5, 6):
        return max(0, count - 2)
    return 0


def asset_record(path: Path):
    doc = glb_json(path)
    primitives = [p for mesh in doc.get("meshes", []) for p in mesh.get("primitives", [])]
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "triangles": sum(primitive_triangles(p, doc.get("accessors", [])) for p in primitives),
        "drawPrimitives": len(primitives),
        "textureFormats": [image.get("mimeType", "external") for image in doc.get("images", [])],
        "animations": len(doc.get("animations", [])),
        "source": SOURCES[path.name],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    assets = [asset_record(path) for path in sorted(MODELS.glob("*.glb"))]
    missing = sorted(set(SOURCES) - {asset["file"] for asset in assets})
    unexpected = sorted({asset["file"] for asset in assets} - set(SOURCES))
    if missing or unexpected:
        raise ValueError(f"Update source provenance mapping; missing={missing}, unexpected={unexpected}")
    manifest = {
        "format": "fishy.render-assets.v2",
        "generators": ["blender/build_natural_assets.py", "blender/build_tetra.py"],
        "naturalSource": "blender/fishy-fidelity-assets.blend",
        "fishSource": "blender/fishy-neon-tetra.blend",
        "materialProvenance": [
            "blender/material-sources/materials-provenance.json",
            "blender/material-sources/fern_02/provenance.json",
        ],
        "inventory": {
            "glbAssets": len(assets),
            "originalNaturalExports": 9,
            "originalNaturalUniqueGeometries": 8,
            "adaptedCc0FernExports": 1,
            "originalTetraExports": 1,
            "sharedGeometryVariants": [{
                "geometry": "Original Fishy fractured river stone",
                "exports": ["rock-rounded.glb", "rock-strata.glb"],
                "materialVariants": ["dark_rock", "lichen_rock"],
            }],
        },
        "assets": assets,
        "totalBytes": sum(asset["bytes"] for asset in assets),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Wrote {len(assets)} assets to {args.output}")


if __name__ == "__main__":
    main()
